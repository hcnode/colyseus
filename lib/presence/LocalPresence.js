"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Utils_1 = require("../Utils");
class LocalPresence {
    constructor() {
        this.channels = {};
        this.data = {};
        this.hash = {};
        this.keys = {};
        this.timeouts = {};
    }
    subscribe(topic, callback) {
        this.channels[topic] = true;
        return this;
    }
    unsubscribe(topic) {
        this.channels[topic] = false;
        return this;
    }
    publish(topic, data) {
        return this;
    }
    async exists(roomId) {
        return this.channels[roomId];
    }
    setex(key, value, seconds) {
        // ensure previous timeout is clear before setting another one.
        if (this.timeouts[key]) {
            clearTimeout(this.timeouts[key]);
        }
        this.keys[key] = value;
        this.timeouts[key] = setTimeout(() => {
            delete this.keys[key];
            delete this.timeouts[key];
        }, seconds * 1000);
    }
    get(key) {
        return this.keys[key];
    }
    del(key) {
        delete this.data[key];
        delete this.hash[key];
    }
    sadd(key, value) {
        if (!this.data[key]) {
            this.data[key] = [];
        }
        if (this.data[key].indexOf(value) === -1) {
            this.data[key].push(value);
        }
    }
    async smembers(key) {
        return this.data[key] || [];
    }
    srem(key, value) {
        if (this.data[key]) {
            Utils_1.spliceOne(this.data[key], this.data[key].indexOf(value));
        }
    }
    scard(key) {
        return this.data[key].length;
    }
    hset(roomId, key, value) {
        if (!this.hash[roomId]) {
            this.hash[roomId] = {};
        }
        this.hash[roomId][key] = value;
    }
    async hget(roomId, key) {
        return this.hash[roomId] && this.hash[roomId][key];
    }
    hdel(roomId, key) {
        if (this.hash[roomId]) {
            delete this.hash[roomId][key];
        }
    }
    async hlen(roomId) {
        return this.hash[roomId] && Object.keys(this.hash[roomId]).length || 0;
    }
}
exports.LocalPresence = LocalPresence;
