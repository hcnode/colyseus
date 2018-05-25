"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const memshared = require("memshared");
class MemsharedPresence {
    constructor() {
        this.subscriptions = {};
    }
    subscribe(topic, callback) {
        this.subscriptions[topic] = (message) => callback(message);
        memshared.subscribe(topic, this.subscriptions[topic]);
        return this;
    }
    unsubscribe(topic) {
        memshared.unsubscribe(topic, this.subscriptions[topic]);
        delete this.subscriptions[topic];
        return this;
    }
    publish(topic, data) {
        memshared.publish(topic, data);
    }
    async exists(roomId) {
        return new Promise((resolve, reject) => {
            memshared.pubsub(roomId, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data.length > 0);
            });
        });
    }
    setex(key, value, seconds) {
        memshared.setex(key, seconds, value);
    }
    async get(key) {
        return new Promise((resolve, reject) => {
            memshared.get(key, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }
    del(roomId) {
        memshared.del(roomId);
    }
    sadd(key, value) {
        memshared.sadd(key, value);
    }
    smembers(key) {
        return new Promise((resolve, reject) => {
            memshared.smembers(key, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }
    srem(key, value) {
        memshared.srem(key, value);
    }
    scard(key) {
        return new Promise((resolve, reject) => {
            memshared.scard(key, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }
    hset(roomId, key, value) {
        memshared.hset(roomId, key, value);
    }
    hget(roomId, key) {
        return new Promise((resolve, reject) => {
            memshared.hget(roomId, key, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }
    hdel(roomId, key) {
        memshared.hdel(roomId, key);
    }
    hlen(roomId) {
        return new Promise((resolve, reject) => {
            memshared.hlen(roomId, (err, data) => {
                if (err) {
                    return reject(err);
                }
                resolve(data);
            });
        });
    }
}
exports.MemsharedPresence = MemsharedPresence;
