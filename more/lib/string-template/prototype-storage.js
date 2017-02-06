import proto from 'env/proto';
import Storage from './storage.js';

const PrototypeStorage = Storage.extend('PrototypeStorage', {
    prototype: Object,

    set: function(name, value) {
        if (this.prototype !== value && this.prototype.isPrototypeOf(value) === false) {
            throw new TypeError(proto.kindOf(this) + '.set() second argument must be a ' + this.prototype);
        }
        return Storage.set.call(this, name, value);
    },

    add(value) {
        return this.set(value.name, value);
    },

    remove(value) {
        return this.delete(value.name);
    },

    createPrototype(...args) {
        return this.prototype.extend(...args);
    },

    register(...args) {
        let prototype = this.createPrototype(...args);
        this.add(prototype);
        return prototype;
    },

    generate(prototype, ...args) {
        return prototype.create(...args);
    },

    findByName(name, safe) {
        let foundPrototype = Storage.get.call(this, name);
        if (!foundPrototype && !safe) {
            throw new Error('missing prototype named ' + name);
        }
        return foundPrototype;
    },

    generateByName(name, ...args) {
        return this.generate(this.findByName(name), ...args);
    }
});

export default PrototypeStorage;
