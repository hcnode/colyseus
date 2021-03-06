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
const parseURL = require("url-parse");
const WebSocket = require("ws");
const Debug_1 = require("./Debug");
const MatchMaker_1 = require("./MatchMaker");
const index_1 = require("./index");
const Protocol_1 = require("./Protocol");
const Utils_1 = require("./Utils");
const PING_INTERVAL = 20 * 1000; // 20 seconds for verifying ping.
function noop() { }
function heartbeat() { this.isAlive = true; }
class Server {
    constructor(options = {}) {
        this.verifyClient = (info, next) => __awaiter(this, void 0, void 0, function* () {
            const req = info.req;
            const url = parseURL(req.url);
            if (this.options.fixedPath) {
                req.roomId = url.pathname.replace(this.options.fixedPath, "").substr(1);
            }
            else {
                req.roomId = url.pathname.substr(1);
            }
            const query = Utils_1.parseQueryString(url.query);
            req.colyseusid = query.colyseusid;
            delete query.colyseusid;
            req.options = query;
            if (req.roomId) {
                const isLocked = yield this.matchMaker.remoteRoomCall(req.roomId, 'locked');
                if (isLocked) {
                    return next(false, Protocol_1.Protocol.WS_TOO_MANY_CLIENTS, 'maxClients reached.');
                }
                // verify client from room scope.
                this.matchMaker.remoteRoomCall(req.roomId, 'onAuth', [req.options]).
                    then((result) => {
                    if (!result) {
                        return next(false);
                    }
                    req.auth = result;
                    next(true);
                }).
                    catch((e) => next(false));
            }
            else {
                next(true);
            }
        });
        this.onConnection = (client, req) => {
            // compatibility with ws / uws
            const upgradeReq = req || client.upgradeReq;
            // set client id
            client.id = upgradeReq.colyseusid || index_1.generateId();
            client.isAlive = true;
            // ensure client has its "colyseusid"
            if (!upgradeReq.colyseusid) {
                Protocol_1.send(client, [Protocol_1.Protocol.USER_ID, client.id]);
            }
            // set client options
            client.options = upgradeReq.options;
            client.auth = upgradeReq.auth;
            // prevent server crashes if a single client had unexpected error
            client.on('error', (err) => Debug_1.debugError(err.message + '\n' + err.stack));
            client.on('pong', heartbeat);
            const roomId = upgradeReq.roomId;
            if (roomId) {
                this.matchMaker.connectToRoom(client, upgradeReq.roomId).
                    catch((e) => {
                    Debug_1.debugError(e.stack || e);
                    Protocol_1.send(client, [Protocol_1.Protocol.JOIN_ERROR, roomId, e && e.message]);
                });
            }
            else {
                client.on('message', this.onMessageMatchMaking.bind(this, client));
            }
        };
        this.presence = options.presence;
        this.matchMaker = new MatchMaker_1.MatchMaker(this.presence);
        this.onShutdownCallback = () => Promise.resolve();
        // "presence" option is not used from now on
        delete options.presence;
        Utils_1.registerGracefulShutdown((signal) => {
            this.matchMaker.gracefullyShutdown().
                then(() => this.shutdown()).
                catch((err) => Debug_1.debugError(`error during shutdown: ${err}`)).
                then(() => process.exit());
        });
        if (options.server) {
            this.attach(options);
        }
        this.options = options;
    }
    attach(options) {
        const engine = options.engine || WebSocket.Server;
        delete options.engine;
        if (options.server || options.port) {
            const customVerifyClient = options.verifyClient;
            options.verifyClient = (info, next) => {
                if (!customVerifyClient) {
                    return this.verifyClient(info, next);
                }
                customVerifyClient(info, (verified, code, message) => {
                    if (!verified) {
                        return next(verified, code, message);
                    }
                    this.verifyClient(info, next);
                });
            };
            this.server = new engine(options);
            this.httpServer = options.server;
        }
        else {
            this.server = options.ws;
        }
        this.server.on('connection', this.onConnection);
        // interval to detect broken connections
        this.pingInterval = setInterval(() => {
            this.server.clients.forEach((client) => {
                //
                // if client hasn't responded after the interval, terminate its connection.
                //
                if (client.isAlive === false) {
                    return client.terminate();
                }
                client.isAlive = false;
                client.ping(noop);
            });
        }, PING_INTERVAL);
    }
    listen(port, hostname, backlog, listeningListener) {
        this.httpServer.listen(port, hostname, backlog, listeningListener);
    }
    register(name, handler, options = {}) {
        return this.matchMaker.registerHandler(name, handler, options);
    }
    onShutdown(callback) {
        this.onShutdownCallback = callback;
    }
    onMessageMatchMaking(client, message) {
        message = Protocol_1.decode(message);
        if (!message) {
            Debug_1.debugError(`couldn't decode message: ${message}`);
            return;
        }
        if (message[0] === Protocol_1.Protocol.JOIN_ROOM) {
            const roomName = message[1];
            const joinOptions = message[2];
            joinOptions.clientId = client.id;
            if (!this.matchMaker.hasHandler(roomName) && !index_1.isValidId(roomName)) {
                Protocol_1.send(client, [Protocol_1.Protocol.JOIN_ERROR, roomName, `Error: no available handler for "${roomName}"`]);
            }
            else {
                this.matchMaker.onJoinRoomRequest(client, roomName, joinOptions).
                    then((roomId) => Protocol_1.send(client, [Protocol_1.Protocol.JOIN_ROOM, roomId, joinOptions.requestId])).
                    catch((e) => {
                    Debug_1.debugError(e.stack || e);
                    Protocol_1.send(client, [Protocol_1.Protocol.JOIN_ERROR, roomName, e && e.message]);
                });
            }
        }
        else if (message[0] === Protocol_1.Protocol.ROOM_LIST) {
            const requestId = message[1];
            const roomName = message[2];
            this.matchMaker.getAvailableRooms(roomName).
                then((rooms) => Protocol_1.send(client, [Protocol_1.Protocol.ROOM_LIST, requestId, rooms])).
                catch((e) => Debug_1.debugError(e.stack || e));
        }
        else {
            Debug_1.debugError(`MatchMaking couldn\'t process message: ${message}`);
        }
    }
    shutdown() {
        clearInterval(this.pingInterval);
        return this.onShutdownCallback();
    }
}
exports.Server = Server;
