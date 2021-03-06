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
const Utils_1 = require("../Utils");
class LocalPresence {
    constructor() {
        // "channels"
        this.rooms = {};
        this.data = {};
        this.hash = {};
    }
    subscribe(topic, callback) {
        this.rooms[topic] = true;
        return this;
    }
    unsubscribe(topic) {
        this.rooms[topic] = false;
        return this;
    }
    publish(topic, data) {
        return this;
    }
    exists(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.rooms[roomId];
        });
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
    smembers(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.data[key] || [];
        });
    }
    srem(key, value) {
        if (this.data[key]) {
            Utils_1.spliceOne(this.data[key], this.data[key].indexOf(value));
        }
    }
    hset(roomId, key, value) {
        if (!this.hash[roomId]) {
            this.hash[roomId] = {};
        }
        this.hash[roomId][key] = value;
    }
    hget(roomId, key) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.hash[roomId] && this.hash[roomId][key];
        });
    }
    hdel(roomId, key) {
        if (this.hash[roomId]) {
            delete this.hash[roomId][key];
        }
    }
    hlen(roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.hash[roomId] && Object.keys(this.hash[roomId]).length || 0;
        });
    }
}
exports.LocalPresence = LocalPresence;
