/// <reference types="ws" />
/// <reference types="node" />
import Clock, { Delayed } from '@gamestdio/timer';
import * as http from 'http';
import * as WebSocket from 'ws';
export { Server } from './Server';
export { Room, RoomAvailable } from './Room';
export { Protocol } from './Protocol';
export { RegisteredHandler } from './matchmaker/RegisteredHandler';
export { Presence } from './presence/Presence';
export { LocalPresence } from './presence/LocalPresence';
export { RedisPresence } from './presence/RedisPresence';
export { MemsharedPresence } from './presence/MemsharedPresence';
export interface EntityMap<T> {
    [entityId: string]: T;
}
export { Clock, Delayed };
export { nonenumerable as nosync } from 'nonenumerable';
export declare function generateId(): string;
export declare function isValidId(id: any): boolean;
export declare type Client = WebSocket & {
    upgradeReq?: http.IncomingMessage;
    id: string;
    options: any;
    sessionId: string;
    isAlive: boolean;
    remote?: boolean;
    auth?: any;
};
