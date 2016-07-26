import proto from 'env/proto';

// it could be called reverse prototypal inheritance on singleton
// we force signleton because we track .instance and not .instances
// why ?
// - to keep implementation to the stric minimum of the requirements
// - SharedMap are required by dictionnary which does not need multiple instances (for now)
// - it's faster

const SharedMap = proto.extend('SharedMap', {
    instance: null,
    instantiated: false,
    object: {},

    constructor() {
        this.instantiated = true;
        if (this.instance !== null) {
            throw new Error(proto.kindOf(this) + '.create() must be called once per instance');
        }

        let prototype = Object.getPrototypeOf(this);
        if (prototype.instantiated === true) { // if prototype if not SharedMap but we need a property in case SharedMap is extended
            prototype.instance = this;
        }

        let object = Object.create(this.object);
        this.object = object;
        this.instance = null;
    },

    extend() {
        let extendedSharedMap = proto.extend.apply(this, arguments);
        extendedSharedMap.object = {};
        return extendedSharedMap;
    },

    has(name) {
        let selfOrInstance = this;
        let has;

        while (true) { // eslint-disable-line no-constant-condition
            if (name in selfOrInstance.object) {
                has = true;
                break;
            }

            selfOrInstance = selfOrInstance.instance;
            if (selfOrInstance === null) {
                has = false;
                break;
            }
        }

        return has;
    },

    get: function(name) {
        let selfOrInstance = this;
        let value;

        while (true) { // eslint-disable-line no-constant-condition
            if (name in selfOrInstance.object) {
                value = selfOrInstance.object[name];
                break;
            }

            selfOrInstance = selfOrInstance.instance;
            if (selfOrInstance === null) {
                break;
            }
        }

        return value;
    },

    set: function(name, value) {
        this.object[name] = value;
    },

    delete(name) {
        if (name in this.object) {
            delete this.object[name];
        }
    }
});

export default SharedMap;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('core', function() {
            let map = SharedMap.create();
            let parentMap = map.create();

            assert(SharedMap.instance === null); // SharedMap is an exception, you can instantiate it multiple times
            assert(map.instance === parentMap); // map is aware of its single instance
            assert(parentMap.instance === null); // parentMap has no instance
            assert.throws(function() {
                map.create();
            });

            map.set('name', 'map');
            parentMap.set('name', 'parentMap');

            assert(map.get('name') === 'map');
            assert(parentMap.get('name') === 'parentMap');

            parentMap.set('foo', 'bar');
            assert(map.get('foo'), 'bar'); // here lies the feature: a property defined on the instance is accessible
        });

        this.add('subclassing', function() {
            let MySharedMap = SharedMap.extend();
            let myMap = MySharedMap.create();
            let parentMyMap = myMap.create();

            assert(MySharedMap.instance === null);
            assert(myMap.instance === parentMyMap);
            assert(parentMyMap.instance === null);
        });
    }
};
