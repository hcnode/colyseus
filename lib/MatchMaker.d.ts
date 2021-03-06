import { Client } from './index';
import { RegisteredHandler } from './matchmaker/RegisteredHandler';
import { Room, RoomAvailable, RoomConstructor } from './Room';
import { Presence } from './presence/Presence';
export declare type ClientOptions = any;
export interface RoomWithScore {
    roomId: string;
    score: number;
}
export declare class MatchMaker {
    handlers: {
        [id: string]: RegisteredHandler;
    };
    private localRooms;
    private presence;
    private isGracefullyShuttingDown;
    constructor(presence?: Presence);
    connectToRoom(client: Client, roomId: string): Promise<void>;
    /**
     * Create or joins the client into a particular room
     *
     * The client doesn't join instantly because this method is called from the
     * match-making process. The client will request a new WebSocket connection
     * to effectively join into the room created/joined by this method.
     */
    onJoinRoomRequest(client: Client, roomToJoin: string, clientOptions: ClientOptions): Promise<string>;
    remoteRoomCall(roomId: string, method: string, args?: any[]): Promise<any>;
    registerHandler(name: string, klass: RoomConstructor, options?: any): RegisteredHandler;
    hasHandler(name: string): boolean;
    joinById(roomId: string, clientOptions: ClientOptions): Promise<string>;
    getAvailableRoomByScore(roomName: string, clientOptions: ClientOptions): Promise<RoomWithScore[]>;
    create(roomName: string, clientOptions: ClientOptions): string;
    getAvailableRooms(roomName: string, roomMethodName?: string): Promise<RoomAvailable[]>;
    getAllRooms(roomName: string, roomMethodName?: string): Promise<RoomAvailable[]>;
    getRoomById(roomId: string): Room<any>;
    gracefullyShutdown(): Promise<any[]>;
    protected getRoomsWithScore(roomName: string, clientOptions: ClientOptions): Promise<RoomWithScore[]>;
    protected createRoomReferences(room: Room, init?: boolean): boolean;
    protected clearRoomReferences(room: Room): void;
    protected getRoomChannel(roomId: any): string;
    private onClientJoinRoom(room, client);
    private onClientLeaveRoom(room, client);
    private lockRoom(roomName, room);
    private unlockRoom(roomName, room);
    private disposeRoom(roomName, room);
}
