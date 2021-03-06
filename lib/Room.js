"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fossilDelta = require("fossil-delta");
const msgpack = require("notepack.io");
const WebSocket = require("ws");
const timeline_1 = require("@gamestdio/timeline");
const timer_1 = require("@gamestdio/timer");
const events_1 = require("events");
const RemoteClient_1 = require("./presence/RemoteClient");
const Protocol_1 = require("./Protocol");
const Utils_1 = require("./Utils");
const jsonPatch = require("fast-json-patch"); // this is only used for debugging patches
const Debug_1 = require("./Debug");
const DEFAULT_PATCH_RATE = 1000 / 20; // 20fps (50ms)
const DEFAULT_SIMULATION_INTERVAL = 1000 / 60; // 60fps (16.66ms)
exports.ROOM_TIMEOUT_WITHOUT_CONNECTIONS = 10 * 1000; // 10 seconds
class Room extends events_1.EventEmitter {
    constructor(presence) {
        super();
        this.clock = new timer_1.default();
        this.maxClients = Infinity;
        this.patchRate = DEFAULT_PATCH_RATE;
        this.autoDispose = true;
        this.clients = [];
        this.remoteClients = {};
        this._locked = false;
        this._lockedExplicitly = false;
        this._maxClientsReached = false;
        this.presence = presence;
        this.setPatchRate(this.patchRate);
    }
    requestJoin(options, isNew) {
        return 1;
    }
    onAuth(options) {
        return true;
    }
    get locked() {
        return this._locked;
    }
    hasReachedMaxClients() {
        return __awaiter(this, void 0, void 0, function* () {
            const connectingClients = (yield this.presence.hlen(this.roomId));
            return (this.clients.length + connectingClients) >= this.maxClients;
        });
    }
    setSimulationInterval(callback, delay = DEFAULT_SIMULATION_INTERVAL) {
        // clear previous interval in case called setSimulationInterval more than once
        if (this._simulationInterval) {
            clearInterval(this._simulationInterval);
        }
        this._simulationInterval = setInterval(() => {
            this.clock.tick();
            callback(this.clock.deltaTime);
        }, delay);
    }
    setPatchRate(milliseconds) {
        // clear previous interval in case called setPatchRate more than once
        if (this._patchInterval) {
            clearInterval(this._patchInterval);
        }
        if (milliseconds !== null && milliseconds !== 0) {
            this._patchInterval = setInterval(this.broadcastPatch.bind(this), milliseconds);
        }
    }
    useTimeline(maxSnapshots = 10) {
        this.timeline = timeline_1.createTimeline(maxSnapshots);
    }
    setState(newState) {
        this.clock.start();
        this._previousState = newState;
        // ensure state is populated for `sendState()` method.
        this._previousStateEncoded = msgpack.encode(this._previousState);
        this.state = newState;
        if (this.timeline) {
            this.timeline.takeSnapshot(this.state);
        }
    }
    setMetadata(meta) {
        this.metadata = meta;
    }
    lock() {
        // rooms locked internally aren't explicit locks.
        this._lockedExplicitly = (arguments[0] === undefined);
        // skip if already locked.
        if (this._locked) {
            return;
        }
        this.emit('lock');
        this._locked = true;
    }
    unlock() {
        // only internal usage passes arguments to this function.
        if (arguments[0] === undefined) {
            this._lockedExplicitly = false;
        }
        // skip if already locked
        if (!this._locked) {
            return;
        }
        this.emit('unlock');
        this._locked = false;
    }
    send(client, data) {
        if (client.readyState === WebSocket.OPEN) {
            Protocol_1.send(client, [Protocol_1.Protocol.ROOM_DATA, data]);
        }
    }
    broadcast(data, options) {
        // no data given, try to broadcast patched state
        if (!data) {
            throw new Error('Room#broadcast: \'data\' is required to broadcast.');
        }
        // encode all messages with msgpack
        if (!(data instanceof Buffer)) {
            data = msgpack.encode([Protocol_1.Protocol.ROOM_DATA, data]);
        }
        let numClients = this.clients.length;
        while (numClients--) {
            const client = this.clients[numClients];
            if (client.readyState === WebSocket.OPEN &&
                (!options || options.except !== client)) {
                client.send(data, { binary: true }, Utils_1.logError.bind(this));
            }
        }
        return true;
    }
    getAvailableData() {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                clients: this.clients.length,
                maxClients: this.maxClients,
                metadata: this.metadata,
                roomId: this.roomId,
            };
        });
    }
    disconnect() {
        const promises = [];
        let i = this.clients.length;
        while (i--) {
            promises.push(this._onLeave(this.clients[i]));
        }
        return Promise.all(promises);
    }
    sendState(client) {
        Protocol_1.send(client, [
            Protocol_1.Protocol.ROOM_STATE,
            this._previousStateEncoded,
            this.clock.currentTime,
            this.clock.elapsedTime,
        ]);
    }
    broadcastPatch() {
        if (!this._simulationInterval) {
            this.clock.tick();
        }
        if (!this.state) {
            Debug_1.debugPatch('trying to broadcast null state. you should call #setState on constructor or during user connection.');
            return false;
        }
        const currentState = this.state;
        const currentStateEncoded = msgpack.encode(currentState);
        // skip if state has not changed.
        if (currentStateEncoded.equals(this._previousStateEncoded)) {
            return false;
        }
        const patches = fossilDelta.create(this._previousStateEncoded, currentStateEncoded);
        // take a snapshot of the current state
        if (this.timeline) {
            this.timeline.takeSnapshot(this.state, this.clock.elapsedTime);
        }
        //
        // debugging
        //
        if (Debug_1.debugPatch.enabled) {
            Debug_1.debugPatch(`"%s" (roomId: "%s") is sending %d bytes:`, this.roomName, this.roomId, patches.length);
        }
        if (Debug_1.debugPatchData.enabled) {
            Debug_1.debugPatchData('%j', jsonPatch.compare(msgpack.decode(this._previousStateEncoded), currentState));
        }
        this._previousState = currentState;
        this._previousStateEncoded = currentStateEncoded;
        // broadcast patches (diff state) to all clients,
        return this.broadcast(msgpack.encode([Protocol_1.Protocol.ROOM_STATE_PATCH, patches]));
    }
    _touchTimeout() {
        clearTimeout(this._disposeIfEmptyAfterCreationTimeout);
        if (this.clients.length > 0) {
            return;
        }
        this._disposeIfEmptyAfterCreationTimeout = setTimeout(() => this._disposeIfEmpty(), exports.ROOM_TIMEOUT_WITHOUT_CONNECTIONS);
    }
    _disposeIfEmpty() {
        if (this.clients.length === 0) {
            this._dispose();
            this.emit('dispose');
        }
    }
    _dispose() {
        let userReturnData;
        if (this.onDispose) {
            userReturnData = this.onDispose();
        }
        if (this._patchInterval) {
            clearInterval(this._patchInterval);
        }
        if (this._simulationInterval) {
            clearInterval(this._simulationInterval);
        }
        // clear all timeouts/intervals + force to stop ticking
        this.clock.clear();
        this.clock.stop();
        return userReturnData || Promise.resolve();
    }
    // allow remote clients to trigger events on themselves
    _emitOnClient(sessionId, event) {
        const remoteClient = this.remoteClients[sessionId];
        if (!remoteClient) {
            Debug_1.debugError(`trying to send event ("${event}") to non-existing remote client (${sessionId})`);
            return;
        }
        if (typeof (event) !== 'string') {
            remoteClient.emit('message', new Buffer(event));
        }
        else {
            remoteClient.emit(event);
        }
    }
    _onMessage(client, message) {
        message = Protocol_1.decode(message);
        if (!message) {
            Debug_1.debugError(`${this.roomName} (${this.roomId}), couldn't decode message: ${message}`);
            return;
        }
        if (message[0] === Protocol_1.Protocol.ROOM_DATA) {
            this.onMessage(client, message[2]);
        }
        else {
            this.onMessage(client, message);
        }
    }
    _onJoin(client, options, auth) {
        // create remote client instance.
        if (client.remote) {
            client = (new RemoteClient_1.RemoteClient(client, this.roomId, this.presence));
            this.remoteClients[client.sessionId] = client;
        }
        this.clients.push(client);
        if (this._disposeIfEmptyAfterCreationTimeout) {
            clearTimeout(this._disposeIfEmptyAfterCreationTimeout);
            this._disposeIfEmptyAfterCreationTimeout = undefined;
        }
        // lock automatically when maxClients is reached
        if (this.clients.length === this.maxClients) {
            this._maxClientsReached = true;
            this.lock.call(this, true);
        }
        // confirm room id that matches the room name requested to join
        Protocol_1.send(client, [Protocol_1.Protocol.JOIN_ROOM, client.sessionId]);
        // emit 'join' to room handler
        this.emit('join', client);
        // bind onLeave method.
        client.on('message', this._onMessage.bind(this, client));
        client.once('close', this._onLeave.bind(this, client));
        // send current state when new client joins the room
        if (this.state) {
            this.sendState(client);
        }
        if (this.onJoin) {
            return this.onJoin(client, options, auth);
        }
    }
    _onLeave(client) {
        let userReturnData;
        // call abstract 'onLeave' method only if the client has been successfully accepted.
        if (Utils_1.spliceOne(this.clients, this.clients.indexOf(client)) && this.onLeave) {
            userReturnData = this.onLeave(client);
        }
        this.emit('leave', client);
        // remove remote client reference
        if (client instanceof RemoteClient_1.RemoteClient) {
            delete this.remoteClients[client.sessionId];
        }
        // custom cleanup method & clear intervals
        if (this.autoDispose) {
            this._disposeIfEmpty();
        }
        // unlock if room is available for new connections
        if (this._maxClientsReached && !this._lockedExplicitly) {
            this._maxClientsReached = false;
            this.unlock.call(this, true);
        }
        return userReturnData || Promise.resolve();
    }
}
exports.Room = Room;
