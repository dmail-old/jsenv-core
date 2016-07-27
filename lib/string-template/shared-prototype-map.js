import proto from 'env/proto';
import SharedMap from 'env/shared-map';

const SharedPrototypeMap = SharedMap.extend('SharedPrototypeMap', {
    prototype: Object,
    object: {},

    set: function(name, value) {
        if (this.prototype !== value && this.prototype.isPrototypeOf(value) === false) {
            throw new TypeError(proto.kindOf(this) + '.set() second argument must be a ' + this.prototype);
        }
        return SharedMap.set.call(this, name, value);
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
        let foundPrototype = SharedMap.get.call(this, name);
        if (!foundPrototype && !safe) {
            throw new Error('missing prototype named ' + name);
        }
        return foundPrototype;
    },

    generateByName(name, ...args) {
        return this.generate(this.findByName(name), ...args);
    }
});

export default SharedPrototypeMap;
