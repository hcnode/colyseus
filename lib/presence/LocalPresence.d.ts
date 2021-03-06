import { Presence } from './Presence';
export declare class LocalPresence implements Presence {
    rooms: {
        [roomId: string]: boolean;
    };
    data: {
        [roomName: string]: string[];
    };
    hash: {
        [roomName: string]: {
            [key: string]: string;
        };
    };
    subscribe(topic: string, callback: Function): this;
    unsubscribe(topic: string): this;
    publish(topic: string, data: any): this;
    exists(roomId: string): Promise<boolean>;
    del(key: string): void;
    sadd(key: string, value: any): void;
    smembers(key: string): Promise<string[]>;
    srem(key: string, value: any): void;
    hset(roomId: string, key: string, value: string): void;
    hget(roomId: string, key: string): Promise<string>;
    hdel(roomId: string, key: any): void;
    hlen(roomId: string): Promise<number>;
}
