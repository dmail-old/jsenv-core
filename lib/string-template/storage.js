import proto from 'env/proto';

const Storage = proto.extend('Storage', {
    object: {},

    constructor() {
        let object = Object.create(this.object);
        this.object = object;
    },

    // extend() {
    //     let extendedStorage = proto.extend.apply(this, arguments);
    //     extendedStorage.object = Object.create(this.object);
    //     return extendedStorage;
    // },

    has(name) {
        return name in this.object;
    },

    get: function(name) {
        return this.object[name];
    },

    set: function(name, value) {
        this.object[name] = value;
    },

    delete(name) {
        if (this.object.hasOwnProperty(name)) {
            delete this.object[name];
        }
    }
});

export default Storage;

export const test = {
    modules: ['@node/assert'],

    main() {
        this.add('core', function() {

        });
    }
};
