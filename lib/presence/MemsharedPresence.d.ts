import { Presence } from './Presence';
export declare class MemsharedPresence implements Presence {
    protected subscriptions: {
        [channel: string]: (...args: any[]) => any;
    };
    subscribe(topic: string, callback: Function): this;
    unsubscribe(topic: string): this;
    publish(topic: string, data: any): void;
    exists(roomId: string): Promise<boolean>;
    del(roomId: string): void;
    sadd(key: string, value: any): void;
    smembers(key: string): Promise<string[]>;
    srem(key: string, value: any): void;
    hset(roomId: string, key: string, value: string): void;
    hget(roomId: string, key: string): Promise<any>;
    hdel(roomId: string, key: string): void;
    hlen(roomId: string): Promise<number>;
}
