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
const Utils_1 = require("./Utils");
const index_1 = require("./index");
const Protocol_1 = require("./Protocol");
const RegisteredHandler_1 = require("./matchmaker/RegisteredHandler");
const LocalPresence_1 = require("./presence/LocalPresence");
const Debug_1 = require("./Debug");
const PRESENCE_TIMEOUT = Number(process.env.COLYSEUS_PRESENCE_TIMEOUT || 8000); // remote room calls timeout
class MatchMaker {
    constructor(presence) {
        this.handlers = {};
        this.localRooms = {};
        this.isGracefullyShuttingDown = false;
        this.presence = presence || new LocalPresence_1.LocalPresence();
    }
    connectToRoom(client, roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = this.localRooms[roomId];
            const clientOptions = client.options;
            const auth = client.auth;
            // assign sessionId to socket connection.
            client.sessionId = yield this.presence.hget(roomId, client.id);
            // clean temporary data
            delete clientOptions.auth;
            delete clientOptions.requestId;
            delete client.options;
            if (this.localRooms[roomId]) {
                room._onJoin(client, clientOptions, client.auth);
            }
            else {
                const remoteSessionSub = `${roomId}:${client.sessionId}`;
                this.presence.subscribe(remoteSessionSub, (message) => {
                    const [method, data] = message;
                    if (method === 'send') {
                        client.send(new Buffer(data), { binary: true });
                    }
                    else if (method === 'close') {
                        client.close(data);
                    }
                });
                yield this.remoteRoomCall(roomId, '_onJoin', [{
                        id: client.id,
                        remote: true,
                        sessionId: client.sessionId,
                    }, clientOptions, client.auth]);
                // forward 'message' events to room's process
                client.on('message', (data) => {
                    // compatibility with uws
                    if (data instanceof ArrayBuffer) {
                        data = new Buffer(data);
                    }
                    this.remoteRoomCall(roomId, '_emitOnClient', [client.sessionId, Array.from(data)]);
                });
                // forward 'close' events to room's process
                client.once('close', (_) => {
                    this.presence.unsubscribe(remoteSessionSub);
                    this.remoteRoomCall(roomId, '_emitOnClient', [client.sessionId, 'close']);
                });
            }
            // clear reserved seat of connecting client into the room
            this.presence.hdel(roomId, client.id);
        });
    }
    /**
     * Create or joins the client into a particular room
     *
     * The client doesn't join instantly because this method is called from the
     * match-making process. The client will request a new WebSocket connection
     * to effectively join into the room created/joined by this method.
     */
    onJoinRoomRequest(client, roomToJoin, clientOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const hasHandler = this.hasHandler(roomToJoin);
            let roomId;
            if (!hasHandler && index_1.isValidId(roomToJoin)) {
                roomId = roomToJoin;
            }
            if (!hasHandler && !index_1.isValidId(roomToJoin)) {
                throw new Error('join_request_fail');
            }
            clientOptions.sessionId = index_1.generateId();
            // check if there's an existing room with provided name available to join
            if (hasHandler) {
                const bestRoomByScore = (yield this.getAvailableRoomByScore(roomToJoin, clientOptions))[0];
                if (bestRoomByScore && bestRoomByScore.roomId) {
                    roomId = bestRoomByScore.roomId;
                }
            }
            if (index_1.isValidId(roomId)) {
                roomId = yield this.joinById(roomId, clientOptions);
            }
            // if couldn't join a room by its id, let's try to create a new one
            if (!roomId && hasHandler) {
                roomId = this.create(roomToJoin, clientOptions);
            }
            if (roomId) {
                this.remoteRoomCall(roomId, '_touchTimeout');
                // Reserve a seat for client id
                this.presence.hset(roomId, client.id, clientOptions.sessionId);
            }
            else {
                throw new Error('join_request_fail');
            }
            return roomId;
        });
    }
    remoteRoomCall(roomId, method, args) {
        return __awaiter(this, void 0, void 0, function* () {
            const room = this.localRooms[roomId];
            if (!room) {
                return new Promise((resolve, reject) => {
                    let unsubscribeTimeout;
                    const requestId = index_1.generateId();
                    const channel = `${roomId}:${requestId}`;
                    const unsubscribe = () => {
                        this.presence.unsubscribe(channel);
                        clearTimeout(unsubscribeTimeout);
                    };
                    this.presence.subscribe(channel, (message) => {
                        const [code, data] = message;
                        if (code === Protocol_1.IpcProtocol.SUCCESS) {
                            resolve(data);
                        }
                        else if (code === Protocol_1.IpcProtocol.ERROR) {
                            reject(data);
                        }
                        unsubscribe();
                    });
                    this.presence.publish(this.getRoomChannel(roomId), [method, requestId, args]);
                    unsubscribeTimeout = setTimeout(() => {
                        unsubscribe();
                        reject(new Error('remote room timed out'));
                    }, PRESENCE_TIMEOUT);
                });
            }
            else {
                if (!args && typeof (room[method]) !== 'function') {
                    return room[method];
                }
                return room[method].apply(room, args);
            }
        });
    }
    registerHandler(name, klass, options = {}) {
        const registeredHandler = new RegisteredHandler_1.RegisteredHandler(klass, options);
        this.handlers[name] = registeredHandler;
        return registeredHandler;
    }
    hasHandler(name) {
        return this.handlers[name] !== undefined;
    }
    joinById(roomId, clientOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield this.presence.exists(this.getRoomChannel(roomId));
            if (!exists) {
                Debug_1.debugMatchMaking(`trying to join non-existant room "${roomId}"`);
                return;
            }
            else if (yield this.remoteRoomCall(roomId, 'hasReachedMaxClients')) {
                Debug_1.debugMatchMaking(`room "${roomId}" reached maxClients.`);
                return;
            }
            else if (!(yield this.remoteRoomCall(roomId, 'requestJoin', [clientOptions, false]))) {
                Debug_1.debugMatchMaking(`can't join room "${roomId}" with options: ${JSON.stringify(clientOptions)}`);
                return;
            }
            return roomId;
        });
    }
    getAvailableRoomByScore(roomName, clientOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.getRoomsWithScore(roomName, clientOptions)).
                sort((a, b) => b.score - a.score);
        });
    }
    create(roomName, clientOptions) {
        const registeredHandler = this.handlers[roomName];
        const room = new registeredHandler.klass();
        // set room public attributes
        room.roomId = index_1.generateId();
        room.roomName = roomName;
        room.presence = this.presence;
        if (room.onInit) {
            room.onInit(Utils_1.merge({}, clientOptions, registeredHandler.options));
        }
        // imediatelly ask client to join the room
        if (room.requestJoin(clientOptions, true)) {
            Debug_1.debugMatchMaking('spawning \'%s\' on process %d', roomName, process.pid);
            room.on('lock', this.lockRoom.bind(this, roomName, room));
            room.on('unlock', this.unlockRoom.bind(this, roomName, room));
            room.on('join', this.onClientJoinRoom.bind(this, room));
            room.on('leave', this.onClientLeaveRoom.bind(this, room));
            room.once('dispose', this.disposeRoom.bind(this, roomName, room));
            // room always start unlocked
            this.createRoomReferences(room, true);
            registeredHandler.emit('create', room);
            return room.roomId;
        }
        else {
            room._dispose();
            return undefined;
        }
    }
    getAvailableRooms(roomName, roomMethodName = 'getAvailableData') {
        return __awaiter(this, void 0, void 0, function* () {
            const roomIds = yield this.presence.smembers(roomName);
            const availableRooms = [];
            yield Promise.all(roomIds.map((roomId) => __awaiter(this, void 0, void 0, function* () {
                const availability = yield this.remoteRoomCall(roomId, roomMethodName);
                if (availability) {
                    availableRooms.push(availability);
                }
                return true;
            })));
            return availableRooms;
        });
    }
    getAllRooms(roomName, roomMethodName = 'getAvailableData') {
        return __awaiter(this, void 0, void 0, function* () {
            const roomIds = yield this.presence.smembers(`a_${roomName}`);
            const rooms = [];
            yield Promise.all(roomIds.map((roomId) => __awaiter(this, void 0, void 0, function* () {
                const availability = yield this.remoteRoomCall(roomId, roomMethodName);
                if (availability) {
                    rooms.push(availability);
                }
                return true;
            })));
            return rooms;
        });
    }
    // used only for testing purposes
    getRoomById(roomId) {
        return this.localRooms[roomId];
    }
    gracefullyShutdown() {
        if (this.isGracefullyShuttingDown) {
            return Promise.reject(false);
        }
        this.isGracefullyShuttingDown = true;
        const promises = [];
        for (const roomId in this.localRooms) {
            if (!this.localRooms.hasOwnProperty(roomId)) {
                continue;
            }
            const room = this.localRooms[roomId];
            // disable autoDispose temporarily, which allow potentially retrieving a
            // Promise from user's `onDispose` method.
            room.autoDispose = false;
            promises.push(room.disconnect());
            promises.push(room._dispose());
            room.emit('dispose');
        }
        return Promise.all(promises);
    }
    getRoomsWithScore(roomName, clientOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const roomsWithScore = [];
            const roomIds = yield this.presence.smembers(roomName);
            const remoteRequestJoins = [];
            yield Promise.all(roomIds.map((roomId) => __awaiter(this, void 0, void 0, function* () {
                const maxClientsReached = yield this.remoteRoomCall(roomId, 'hasReachedMaxClients');
                // check maxClients before requesting to join.
                if (maxClientsReached) {
                    return;
                }
                const localRoom = this.localRooms[roomId];
                if (!localRoom) {
                    remoteRequestJoins.push(new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                        const score = yield this.remoteRoomCall(roomId, 'requestJoin', [clientOptions, false]);
                        resolve({ roomId, score });
                    })));
                }
                else {
                    roomsWithScore.push({
                        roomId,
                        score: localRoom.requestJoin(clientOptions, false),
                    });
                }
                return true;
            })));
            return (yield Promise.all(remoteRequestJoins)).concat(roomsWithScore);
        });
    }
    createRoomReferences(room, init = false) {
        this.localRooms[room.roomId] = room;
        // add unlocked room reference
        this.presence.sadd(room.roomName, room.roomId);
        if (init) {
            // add alive room reference (a=all)
            this.presence.sadd(`a_${room.roomName}`, room.roomId);
            this.presence.subscribe(this.getRoomChannel(room.roomId), (message) => {
                const [method, requestId, args] = message;
                const reply = (data) => {
                    this.presence.publish(`${room.roomId}:${requestId}`, data);
                };
                // reply with property value
                if (!args && typeof (room[method]) !== 'function') {
                    return reply([Protocol_1.IpcProtocol.SUCCESS, room[method]]);
                }
                // reply with method result
                let response;
                try {
                    response = room[method].apply(room, args);
                }
                catch (e) {
                    Debug_1.debugError(e.stack || e);
                    return reply([Protocol_1.IpcProtocol.ERROR, e.message || e]);
                }
                if (!(response instanceof Promise)) {
                    return reply([Protocol_1.IpcProtocol.SUCCESS, response]);
                }
                response.
                    then((result) => reply([Protocol_1.IpcProtocol.SUCCESS, result])).
                    catch((e) => {
                    Debug_1.debugError(e.stack || e);
                    reply([Protocol_1.IpcProtocol.ERROR, e.message || e]);
                });
            });
        }
        return true;
    }
    clearRoomReferences(room) {
        this.presence.srem(room.roomName, room.roomId);
        // clear list of connecting clients.
        this.presence.del(room.roomId);
    }
    getRoomChannel(roomId) {
        return `$${roomId}`;
    }
    onClientJoinRoom(room, client) {
        this.handlers[room.roomName].emit('join', room, client);
    }
    onClientLeaveRoom(room, client) {
        this.handlers[room.roomName].emit('leave', room, client);
    }
    lockRoom(roomName, room) {
        this.clearRoomReferences(room);
        // emit public event on registered handler
        this.handlers[room.roomName].emit('lock', room);
    }
    unlockRoom(roomName, room) {
        if (this.createRoomReferences(room)) {
            // emit public event on registered handler
            this.handlers[room.roomName].emit('unlock', room);
        }
    }
    disposeRoom(roomName, room) {
        Debug_1.debugMatchMaking('disposing \'%s\' on process %d', roomName, process.pid);
        // emit disposal on registered session handler
        this.handlers[roomName].emit('dispose', room);
        // remove from alive rooms
        this.presence.srem(`a_${roomName}`, room.roomId);
        // remove from available rooms
        this.clearRoomReferences(room);
        // unsubscribe from remote connections
        this.presence.unsubscribe(this.getRoomChannel(room.roomId));
        // remove actual room reference
        delete this.localRooms[room.roomId];
    }
}
exports.MatchMaker = MatchMaker;
