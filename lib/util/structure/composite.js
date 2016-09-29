/*
Composite, Composable, Composition, Component
*/

import util from './util.js';

const Component = util.extend({
    constructor(composition) {
        this.composition = composition;
    },
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
    constructor(composite) {
        this.composite = composite;
        this.components = [];
    },
    composite: null,
    components: [],

    // called to link a composite instance
    link(composite) {
        let instance = Object.create(this);

        instance.linked = true;
        instance.composite = composite;
        instance.components = [];
        this.components.forEach(function(component) {
            instance.add(component);
        }, this);

        return instance;
    },
    linked: false,

    createComponent(...args) {
        const Model = Component.extend(...args);
        Model.composition = this;
        return Model;
    },

    add(Component) {
        // you can compose after instantiation of the composition, component are made to be instantiated with the composite
        // but you may add or remove component on the fly
        // in such circumstances the component must be

        let component;
        if (this.linked) {
            component = Object.create(Component);
        } else {
            component = Component;
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
    extend() {
        let extended = util.extend.apply(this, arguments);
        extended.composition = Composition.create(extended);
        return extended;
    },
    composition: null,

    constructor() {
        this.composition = this.composition.link(this);
    }
});

export default Composite;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('using composition by extending Composite (recommended)', function() {
            const Item = Composite.extend();
            const Composition = Item.composition;
            const FirstComponent = Composition.createComponent({
                name: 'first'
            });
            const SecondComponent = Composition.createComponent({
                name: 'second'
            });
            Composition.add(FirstComponent);
            Composition.add(SecondComponent);

            assert(Item.first === FirstComponent);
            assert(Item.second === SecondComponent);

            const item = Item.create();
            const composition = item.composition;
            const firstComponent = composition.components[0];
            const secondComponent = composition.components[1];

            assert(composition.components.length === 2);
            assert(item.first === firstComponent);
            assert(item.second === secondComponent);

            composition.remove(item.second);
            assert(item.second === null);
            assert(composition.components.length === 1);

            Composition.remove(FirstComponent);
            assert(Composition.components.length === 1);
            assert(Item.first === null);
        });

        // will certainly be used often when your item is composable but must inherit from something else
        // than Composite that is just an helper that would just use Composable interface
        // maybe just creating a Composable interface would do the trick, and you would just have
        // to instantiate composition in the constructor
        this.add('using composition with an item extending something else than composite', function() {
            // const Item = util.extend(Composable, {
            //     constructor() {
            //         this.composition = this.composition.link(this);
            //     }
            // });
        });
    }
};
