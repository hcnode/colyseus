import * as redis from 'redis';
import { Presence } from './Presence';
export declare class RedisPresence implements Presence {
    sub: redis.RedisClient;
    pub: redis.RedisClient;
    protected subscriptions: {
        [channel: string]: (...args: any[]) => any;
    };
    protected smembersAsync: any;
    protected hgetAsync: any;
    protected hlenAsync: any;
    protected pubsubAsync: any;
    constructor(opts?: redis.ClientOpts);
    subscribe(topic: string, callback: Function): this;
    unsubscribe(topic: string): this;
    publish(topic: string, data: any): void;
    exists(roomId: string): Promise<boolean>;
    del(roomId: string): void;
    sadd(key: string, value: any): void;
    smembers(key: string): Promise<string[]>;
    srem(key: string, value: any): void;
    hset(roomId: string, key: string, value: string): void;
    hget(roomId: string, key: string): any;
    hdel(roomId: string, key: string): void;
    hlen(roomId: string): Promise<number>;
}
