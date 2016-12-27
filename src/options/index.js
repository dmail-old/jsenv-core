// will use clone with predefined options in order to concatenate array

import proto from 'env/proto';
// import Item from 'env/item';

// function createOptions(defaultOptions, userOptions) {
//     // return new Item.Factory(defaultOptions || {}, {mergeValue: userOptions || null, arrayConcat: true}).generate();

//     return Item.concat(defaultOptions, userOptions);
// }

let Options = {
    allowObject: false, // let to false because object structure are often circular and deep while we only want option
    // to be merged

    is(item, allowObject = false) {
        return item !== null && typeof item === 'object' && (allowObject || item instanceof Object === false);
    },

    create(defaultOptions, ...args) {
        // let options = createOptions(defaultOptions, userOptions);
        let options;
        let length = arguments.length;

        if (length > 0 && Options.is(defaultOptions, this.allowObject)) {
            options = Object.create(defaultOptions);
            proto.define.apply(options, args);
        } else {
            options = Object.create(null);
            proto.define.apply(options, arguments);
        }

        // for the whole structure, every time, every options object is recreated but without more property
        for (let key in options) { // eslint-disable-line guard-for-in
            let value = defaultOptions[key];
            if (Options.is(value, this.allowObject)) {
                options[key] = Options.create(value);
            }
        }

        return options;
    },

    setPrototype(customOptions, prototypeOptions) {
        return this.create(prototypeOptions, customOptions);
    },

    removePrototype(customOptions) {
        return this.create(customOptions);
    },

    has(options, name) {
        return name in options;
    },

    ensure(options, name) {
        if (this.has(options, name) === false) {
            throw new Error('no such option : ' + name);
        }
        return options[name];
    }
};

/*
isPrototypeProperty(name) {
    let owner = this.items;
    let ownedByPrototype = false;

    while (owner) {
        if (owner.hasOwnProperty(name)) {
            if (owner === Object.prototype) {
                ownedByPrototype = true;
            }
            break;
        }
        owner = Object.getPrototypeof(owner);
    }

    return ownedByPrototype;
}
*/

export default Options;

// because util/options is part of the module loaded before the test module it cannot be tested because
// System.trace was not set to true before
export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add("create(defaultOptions)", function() {
            let options = Options.create({
                key: 'value'
            });

            assert.equal(options.key, 'value');
        });

        this.add("create(defaultOptions, userOptions)", function() {
            let options = Options.create({key: 'value'}, {foo: 'bar'});

            assert.equal(options.foo, 'bar');
        });
    }
};
