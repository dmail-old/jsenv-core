/*
Composite, Composable, Composition, Component
*/

import util from './util.js';

const Component = util.extend({
    composition: null,

    link(composite) {
        const name = this.name;
        if (name) {
            composite[name] = this;
        }
    },
    name: '',

    unlink(composite) {
        const name = this.name;
        if (name) {
            composite[name] = null;
        }
    }
});

const Composition = util.extend({
    composite: null,
    components: [],

    constructor() {
        this.components = [];
    },

    // called to link a composite instance
    link(composite) {
        this.linked = true;
        this.composite = composite;
        Object.getPrototypeOf(this).components.forEach(function(component) {
            this.add(component);
        }, this);
    },
    linked: false,
    unlink() {
        delete this.linked;
        delete this.composite;
        this.components = [];
    },

    add(Component) {
        // you can compose after instantiation of the composition, component are made to be instantiated with the composite
        // but you may add or remove component on the fly
        // in such circumstances the component must be

        let component;
        if (this.linked) {
            component = Component.create();
            component.composition = this;
        } else {
            component = Component.extend();
            component.composition = this;
        }

        this.components.push(component);
        component.link(this.composite);
        return component;
    },

    remove(component) {
        const index = this.components.indexOf(component);
        component.unlink(this.composite);
        this.components.splice(index, 1);
    }
});

const Composite = util.extend({
    composition: Composition,
    extend() {
        let extended = util.extend.apply(this, arguments);
        extended.composition = Composition.extend({
            composite: extended,
            components: []
        });
        return extended;
    },

    constructor() {
        this.composition = this.composition.create();
        this.composition.link(this);
    }
});

// iteration methods
Component.define({
    createNextIterable() {
        const components = this.composition.components;
        const index = components.indexOf(this);
        return components.slice(index + 1);
    },

    createPreviousIterable() {
        const components = this.composition.components;
        const index = components.indexOf(this);
        return components.slice(0, index).reverse();
    },

    createAncestorIterable() {
        let component = this;

        return createIterable(function() {
            let composition = component.composition;
            component = composition;
            // if the composition has a composition property
            // it's considered as a component too

            const result = {
                done: !composition,
                value: composition
            };

            return result;
        });
    }
});
Composition.define({
    [Symbol.iterator]() {
        return this.createComponentIterable();
    },

    createComponentIterable() {
        return this.components;
    },

    createReversedComponentIterable() {
        return this.components.reverse();
    }
});
function createIterable(nextMethod) {
    return {
        [Symbol.iterator]: function() {
            return this;
        },
        next: nextMethod
    };
}
// iteration properties
Component.define({
    get previousSibling() {
        const components = this.composition.components;
        const index = components.indexOf(this);
        return index === 0 ? null : components[index - 1];
    },

    get nextSibling() {
        const components = this.composition.components;
        const index = components.indexOf(this);
        return index === components.length - 1 ? null : components[index + 1];
    },

    get parent() {
        const composition = this.composition;
        return 'composition' in composition ? composition : null;
    }
});
Composition.define({
    get first() {
        const components = this.components;
        const length = components.length;
        return length === 0 ? null : components[0];
    },

    get last() {
        const components = this.components;
        const length = components.length;
        return length === 0 ? null : components[length - 1];
    }
});

export default Composite;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('using composition by extending Composite (recommended)', function() {
            const Item = Composite.extend();
            const Composition = Item.composition;
            const FirstComponent = Component.extend({
                name: 'foo'
            });
            const SecondComponent = Component.extend({
                name: 'bar'
            });
            Composition.add(FirstComponent);
            Composition.add(SecondComponent);

            assert(Object.getPrototypeOf(Item.foo) === FirstComponent);
            assert(Object.getPrototypeOf(Item.bar) === SecondComponent);
            assert(Composition.first === Item.foo);
            assert(Composition.last === Item.bar);
            assert(Item.foo.nextSibling === Item.bar);
            assert(Item.bar.nextSibling === null);
            assert(Item.foo.previousSibling === null);
            assert(Item.bar.previousSibling === Item.foo);

            const item = Item.create();
            const composition = item.composition;
            const firstComponent = composition.components[0];
            const secondComponent = composition.components[1];

            assert(composition.components.length === 2);
            assert(composition.first === item.foo);
            assert(composition.last === item.bar);
            assert(item.foo === firstComponent);
            assert(item.bar === secondComponent);
            assert(item.foo.nextSibling === item.bar);
            assert(item.bar.nextSibling === null);
            assert(item.foo.previousSibling === null);
            assert(item.bar.previousSibling === item.foo);

            composition.remove(item.bar);
            assert(item.bar === null);
            assert(composition.components.length === 1);

            Composition.remove(Item.foo);
            assert(Composition.components.length === 1);
            assert(Item.foo === null);
        });

        // will certainly be used often when your item is composable but must inherit from something else
        // than Composite that is just an helper that would just use Composable interface
        // maybe just creating a Composable interface would do the trick, and you would just have
        // to instantiate composition in the constructor
        this.add('using composition with an item extending something else than composite', function() {
            // const Item = util.extend(Composite, {
            //     constructor() {
            //         this.composition = this.composition.create();
            //         this.composition.link(this);
            //     }
            // });
        });
    }
};
