/// <reference types="node" />
import { Timeline } from '@gamestdio/timeline';
import Clock from '@gamestdio/timer';
import { EventEmitter } from 'events';
import { Client } from './index';
import { Presence } from './presence/Presence';
import { RemoteClient } from './presence/RemoteClient';
export declare const ROOM_TIMEOUT_WITHOUT_CONNECTIONS: number;
export declare type SimulationCallback = (deltaTime?: number) => void;
export interface RoomConstructor<T = any> {
    new (presence?: Presence): Room<T>;
}
export interface RoomAvailable {
    roomId: string;
    clients: number;
    maxClients: number;
    metadata?: any;
}
export interface BroadcastOptions {
    except: Client;
}
export declare abstract class Room<T = any> extends EventEmitter {
    clock: Clock;
    timeline?: Timeline;
    roomId: string;
    roomName: string;
    maxClients: number;
    patchRate: number;
    autoDispose: boolean;
    state: T;
    metadata: any;
    presence: Presence;
    clients: Client[];
    protected remoteClients: {
        [sessionId: string]: RemoteClient;
    };
    private _previousState;
    private _previousStateEncoded;
    private _simulationInterval;
    private _patchInterval;
    private _locked;
    private _lockedExplicitly;
    private _maxClientsReached;
    private _disposeIfEmptyAfterCreationTimeout;
    constructor(presence?: Presence);
    abstract onMessage(client: Client, data: any): void;
    onInit?(options: any): void;
    onJoin?(client: Client, options?: any, auth?: any): void | Promise<any>;
    onLeave?(client: Client): void | Promise<any>;
    onDispose?(): void | Promise<any>;
    requestJoin(options: any, isNew?: boolean): number | boolean;
    onAuth(options: any): boolean | Promise<any>;
    readonly locked: boolean;
    hasReachedMaxClients(): Promise<boolean>;
    setSimulationInterval(callback: SimulationCallback, delay?: number): void;
    setPatchRate(milliseconds: number): void;
    useTimeline(maxSnapshots?: number): void;
    setState(newState: any): void;
    setMetadata(meta: any): void;
    lock(): void;
    unlock(): void;
    send(client: Client, data: any): void;
    broadcast(data: any, options?: BroadcastOptions): boolean;
    getAvailableData(): Promise<RoomAvailable>;
    disconnect(): Promise<any>;
    protected sendState(client: Client): void;
    protected broadcastPatch(): boolean;
    protected _touchTimeout(): void;
    protected _disposeIfEmpty(): void;
    protected _dispose(): Promise<any>;
    private _emitOnClient(sessionId, event);
    private _onMessage(client, message);
    private _onJoin(client, options?, auth?);
    private _onLeave(client);
}
