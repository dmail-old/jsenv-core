/**

Sort an array towards the properties of object he contains

orderBy('name');
orderBy('name');
orderBy('name', 'index', -1, function(a){ return a.name.toLowerCase(); }, 'getCount()');

*/

import proto from 'proto';

const Distinction = proto.extend('Distinction', {
    order: 1,

    constructor(valueGetter, order) {
        this.get = valueGetter;
        if (order) {
            this.order = order;
        }
    }
});

const Comparer = proto.extend('Comparer', {
    constructor(args) {
        this.distinctions = args ? this.createDistinctions(args) : [];
        this.compare = this.compare.bind(this);
    },

    createDistinctionGetter(path) {
        return function(a) {
            return a[path];
        };
    },

    createDistinctions(args) {
        var i = 0;
        var j = args.length;
        var arg;
        var distinctions = [];

        for (;i < j; i++) {
            arg = args[i];
            if (typeof arg === 'function') {
                distinctions.push(Distinction.create(arg));
            } else if (typeof arg === 'number') {
                if (i !== 0) {
                    distinctions[distinctions.length - 1].order = arg;
                }
            } else if (typeof arg === 'string') {
                distinctions.push(Distinction.create(this.createDistinctionGetter(arg)));
            }
        }

        return distinctions;
    },

    add(...args) {
        var distinction = Distinction.create(...args);
        this.distinctions.push(distinction);
    },

    compare(a, b) {
        var distinctions = this.distinctions;
        var i = 0;
        var j = distinctions.length;
        var distinction;
        var va;
        var vb;

        for (;i < j; i++) {
            distinction = distinctions[i];
            va = distinction.get(a);
            vb = distinction.get(b);

            if (va > vb) {
                return distinction.order;
            }
            if (va < vb) {
                return -distinction.order;
            }
        }

        return 0;
    }
});

export default Comparer;
