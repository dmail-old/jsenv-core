/*
Composite, Composable, Composition, Component
*/

import util from './util.js';

const Component = util.extend({
    constructor() {
        this.linked = false;
        this.composition = null;
    },

    link(composition) {
        // if (this.linked) {
        //     throw new Error('component.link must be called on a non-linked component');
        // }

        const linked = this.create();
        linked.linked = true;
        linked.composition = composition;
        return linked;
    },

    unlink() {
        // if (this.linked === false) {
        //     throw new Error('component.unlink must be called on a linked component');
        // }
        delete this.linked;
        delete this.composition;
    },

    callHook(name, ...args) {
        return this.lifecycle[name].apply(this, args);
    },

    lifecycle: {
        linked(composite) {
            if (this.installPropertyOnComposite) {
                const name = this.name;
                if (name) {
                    composite[name] = this;
                }
            }
        },

        unlinked(composite) {
            if (this.installPropertyOnComposite) {
                const name = this.name;
                if (name) {
                    delete composite[name];
                }
            }
        }
    },
    name: '',
    installPropertyOnComposite: true
});

const Composition = util.extend({
    constructor() {
        this.linked = false;
        this.composite = null;
        this.components = [];
    },

    link(composite) {
        const linked = this.create();

        linked.linked = true;
        linked.composite = composite;
        this.components.forEach(function(component) {
            linked.add(component);
        }, this);

        return linked;
    },

    // you can add/remove Component at any time
    add(component) {
        let linkedComponent = component.link(this);
        this.components.push(linkedComponent);
        linkedComponent.callHook('linked', this.composite);
        return linkedComponent;
    },

    unlink() {
        delete this.linked;
        delete this.composite;
        delete this.components;
    },

    remove(component) {
        const index = this.components.indexOf(component);
        component.callHook('unlinked', this.composite);
        component.unlink(this.composite);
        this.components.splice(index, 1);
    }
});

const Composite = util.extend({
    composition: Composition.create(),
    extend() {
        let extended = util.extend.apply(this, arguments);
        extended.composition = this.composition.link(extended);
        return extended;
    },

    compose(component) {
        if (arguments.length === 0) {
            component = Component.create();
        }
        return this.composition.add(component);
    },

    constructor() {
        this.composition = this.composition.link(this);
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
            Item.compose(FirstComponent);
            Item.compose(SecondComponent);

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
            assert(item.bar === Item.bar);
            assert(composition.components.length === 1);

            Composition.remove(Item.foo);
            assert(Composition.components.length === 1);
            // the property foo must not be set because Item.foo component is removed from the Item.composition
            assert('foo' in Item === false);
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
