/* eslint-disable no-use-before-define */

import util from './util.js';

/*
               elementA.linker
        ┌──────────────────────────┐
        │      linker.links[0]     │
elementA│o------------------------o│elementB
        │      linker.links[1]     │
        │o------------------------o│elementC
        └──────────────────────────┘
*/

// Data, PrimitiveData -> pref this
// Variable, PrimitiveVariable
// Twin
// Mirror
// Shadow -> j'aime beaucoup shadow, dans l'idée du shadow dom en plus
// Derived
// Trace -> le meilleur je pense parce que shadow c'est trop connoté et trace c'est plus générique
// Chemistry?
// Lab ? -> j'aime ça pour laboratory
// Sandbox
// y'aurais donc Lab.scan
// Pharmacy, Atom (on a déjà Link qui sers à lié des atomes)
// Formula, Recipe, Composition
// synthesize
// https://fr.wikipedia.org/wiki/Chimie#Structure_de_la_mati.C3.A8re

/*
What we want first is to create an object per JavaScript value type
This is the Lab object below that will return element corresponding to value using Lab.scan(value)
*/
const Lab = util.extend({
    scan(value) {
        const ElementMatchingValue = this.findElementByValueMatch(value);
        const element = ElementMatchingValue.create();
        element.initialize(value);
        return element;
    },

    findElementByValueMatch(value) {
        if (arguments.length === 0) {
            throw new Error('Lab.findElementByValueMatch expect one arguments');
        }
        let ElementMatchingValue = this.Elements.find(function(Element) {
            return Element.match(value);
        });
        if (!ElementMatchingValue) {
            throw new Error('no registered element matches value ' + value);
        }
        return ElementMatchingValue;
    },
    Elements: []
});

/*
Add createElement() which can create an element of the right type using its name
*/
Lab.define({
    createElement(name, value) {
        const ElementMatchingName = this.findElementByName(name);
        const element = ElementMatchingName.create();
        if (arguments.length === 1) {
            element.initialize();
        } else {
            element.initialize(value);
        }
        return element;
    },

    findElementByName(name) {
        if (arguments.length === 0) {
            throw new Error('Lab.findElementByName expect one arguments');
        }
        let ElementUsignName = this.Elements.find(function(Element) {
            return Element.name === name;
        });
        if (!ElementUsignName) {
            throw new Error('no registered element named ' + name);
        }
        return ElementUsignName;
    }
});

/*
Create the Element object, basically it's just a wrapper to a JavaScript value
- match() method is used to know if the Element matches the value
- createDefaultValue() is usefull when Element is created without value
- extend() creates a new Element and register it inside the Lab
*/
const Element = util.extend({
    match() {

    },

    constructor() {

    },

    initialize() {
        let value;
        if (arguments.length > 0) {
            value = arguments[0];
        } else {
            value = this.createDefaultValue();
        }
        this.value = value;
        this.initializer(value);
    },

    createDefaultValue() {

    },

    initializer() {

    },

    extend(name, ...args) {
        const Element = util.extend.apply(this, args);
        Element.name = name;

        Element.Composition = this.Composition.extend({
            Constituents: []
        });
        Lab.register(Element, this);
        return Element;
    }
});

Element.define({
    lifecycle: {
        extended() {},
        created() {},
        added() {},
        removed() {}
    }
});

/*
Add the Lab.register method
*/
Lab.define({
    register(Element, ExtendedElement) {
        let ExtendedElementIndex;

        if (ExtendedElement) {
            ExtendedElementIndex = this.Elements.indexOf(ExtendedElement);
        } else {
            ExtendedElementIndex = -1;
        }

        if (ExtendedElementIndex === -1) {
            this.Elements.push(Element);
        } else {
            this.Elements.splice(ExtendedElementIndex, 0, Element);
        }
    }
});

/*
Now to be able to define how element are composed we prepare a Constituent object
an Element may define many Constituent that will contain their own logic of how the element is composed
A composant must be able to link the element with other element(s)
*/
const Constituent = util.extend({
    pure: true,
    constructor(element) {
        if (Element.isPrototypeOf(element) === false) {
            throw new TypeError('Constituent constructor first argument must be an element');
        }

        this.pure = false;
        this.element = element;
        this.linkedElements = [];

        const shortcut = this.elementShortcut;
        if (shortcut) {
            element[shortcut] = this;
        }
        this.elementProperties.forEach(function(elementProperty) {
            element[elementProperty] = this[elementProperty].bind(this);
        }, this);
    },

    elementShortcut: '',
    elementProperties: [],

    initialize(element) {
        this.initializer(element.value);
    },

    initializer() {

    },

    link() {
        const link = this.createLink.apply(this, arguments);

        link.initialize(this.element);

        return link;
    },

    linkElement(element) {
        let link = this.createLink();

        link.add(element);
        link.initialize(this.element);

        return link;
    },

    createLink() {
        const link = Link.create(this);
        return link;
    },

    unlink(element) {
        element.link.detach();
    },

    add(element) {
        const list = this.linkedElements;
        list.push(element);

        element.lifecycle.added();
    },

    remove(element) {
        const list = this.linkedElements;
        const index = list.indexOf(element);
        list.splice(index, 1);

        element.lifecycle.removed();
    }
});

const Link = util.extend({
    constructor(constituent) {
        this.fragment = []; // link may concern more then one element, even if 99% of the time it's only one
        this.constituent = constituent;
    },

    initialize(element) {
        this.initializer(element.value);
    },

    initializer() {

    },

    detach() {
        this.constituent = null;
    },

    connect(value) {
        const childElement = this.createElement(value);

        this.add(childElement);

        return childElement;
    },

    createElement(value) {
        const Element = Lab.findElementByValueMatch(value);

        let previousElementUsingSameValue;
        if (Element.referencable) {
            previousElementUsingSameValue = this.findPreviousElementByValue(value);
        }

        let element;
        if (previousElementUsingSameValue) {
            console.log('make element a pointer on', value);
            element = PointerElement.create(previousElementUsingSameValue);
        } else {
            element = Element.create();
        }

        element.link = this;

        return element;
    },

    findPreviousElementByValue(value) {
        let previousElementUsingSameValue;
        let previousElement;
        let lastElement = this.last;

        if (lastElement) {
            previousElement = lastElement;
        } else {
            previousElement = this;
        }

        if (previousElement.value === value) {
            previousElementUsingSameValue = previousElement;
        } else {
            for (previousElement of previousElement.createPreviousElementIterable()) {
                if (previousElement.value === value) {
                    previousElementUsingSameValue = previousElement;
                    break;
                }
            }
        }

        return previousElementUsingSameValue;
    },

    add(element) {
        if (Element.isPrototypeOf(element) === false) {
            throw new TypeError('Link constructor first argument must be an element');
        }
        element.link = this;
        this.fragment.push(element);

        const constituent = this.constituent;
        if (constituent) {
            constituent.add(element);
        }
    },

    removeAll() {
        this.fragment.forEach(function(element) {
            this.constituent.remove(element);
        }, this);
    }
});

// this object is responsible to handle the list of constituent of an element
const Composition = util.extend({
    Constituents: [],
    pure: true,
    add(Constituent) {
        if (Constituent.pure) {
            if (this.pure) {
                this.Constituents.push(Constituent);
            } else {
                return this.compose(Constituent);
            }
        } else {
            this.constituents.push(Constituent);
        }
    },

    compose() {
        const constituent = this.createConstituent.apply(this, arguments);
        this.constituents.push(constituent);
        constituent.initialize(this.element);
        return constituent;
    },

    createConstituent(CustomConstituent) {
        const constituent = (CustomConstituent || Constituent).create(this.element);
        return constituent;
    },

    get(Constituent) {
        let constituent;
        if (this.pure) {
            constituent = this.Constituents.find(function(SelfConstituent) {
                return SelfConstituent === Constituent;
            });
        } else {
            constituent = this.constituents.find(function(constituent) {
                return Constituent.isPrototypeOf(constituent);
            });
        }
        return constituent;
    },

    ensure(Constituent) {
        let constituent = this.get(Constituent);
        if (!constituent) {
            constituent = this.add(Constituent);
        }
        return constituent;
    },

    constructor(element) {
        this.element = element;
        this.pure = false;
        this.constituents = this.Constituents.map(function(Constituent) {
            return Constituent.create(element);
        }, this);
    },

    initiliazer() {
        this.constituents.forEach(function(constituent) {
            constituent.initialize(this.element);
        }, this);
    }
});

Element.define({
    Composition: Composition,

    constructor() {
        this.composition = Composition.create(this);
    },

    initializer(value) {
        this.composition.initializer(value);
    }
});

/* iteration methods */
Element.define({
    get parent() {
        const link = this.link;
        const parentElement = link ? link.constituent.element : null;

        return parentElement;
    },

    createNextElementIterable() {
        let element = this;

        return createIterable(function() {
            let nextElement = element.next;
            element = nextElement;

            const result = {
                done: !nextElement,
                value: nextElement
            };

            return result;
        });
    },

    get next() {
        let next;

        let depthlessElement = this.depthless;
        if (depthlessElement) {
            next = depthlessElement;
        } else {
            const nextSibling = this.nextSibling;
            if (nextSibling) {
                next = nextSibling;
            } else {
                // search if a parent element got element after themselves
                let ancestorElement = this.parent;
                let ancestorNextSiblingElement;

                while (ancestorElement) {
                    ancestorNextSiblingElement = ancestorElement.nextSibling;
                    if (ancestorNextSiblingElement) {
                        break;
                    } else {
                        ancestorElement = ancestorElement.parent;
                    }
                }

                if (ancestorNextSiblingElement) {
                    next = ancestorNextSiblingElement;
                } else {
                    next = null;
                }
            }
        }

        return next;
    },

    get depthless() {
        return this.first;
    },

    get first() {
        const firstElement = this.composition.getFirstElement();
        return firstElement;
    },

    // set first(element) {
    //     const list = this.linker;
    //     const link = list.createLink(element);
    //     list.unshift(link);
    //     return element;
    // },

    get nextSibling() {
        let nextSiblingElement;

        const parentElement = this.parent;
        if (parentElement) {
            nextSiblingElement = parentElement.composition.getNextSiblingElementOf(this);
        } else {
            nextSiblingElement = null;
        }

        return nextSiblingElement;
    },

    createPreviousElementIterable() {
        let element = this;

        return createIterable(function() {
            let previousElement = element.prev;
            element = previousElement;

            const result = {
                done: !previousElement,
                value: previousElement
            };

            return result;
        });
    },

    get prev() {
        let prevElement;

        const prevSibling = this.prevSibling;

        if (prevSibling) {
            let deepest = prevSibling.deepest;
            if (deepest) {
                prevElement = deepest;
            } else {
                prevElement = prevSibling;
            }
        } else {
            const parentElement = this.parent;
            if (parentElement) {
                prevElement = parentElement;
            } else {
                prevElement = null;
            }
        }

        return prevElement;
    },

    get prevSibling() {
        let prevSiblingElement;

        const parentElement = this.parent;
        if (parentElement) {
            prevSiblingElement = parentElement.composition.getPreviousSiblingElementOf(this);
        } else {
            prevSiblingElement = null;
        }

        return prevSiblingElement;
    },

    get deepest() {
        let lastElement = this.last;
        let deepestElement = lastElement;

        if (lastElement) {
            deepestElement = lastElement;

            while (true) { // eslint-disable-line
                let deepestLastElement = deepestElement.last;
                if (deepestLastElement) {
                    deepestElement = deepestLastElement;
                } else {
                    break;
                }
            }
        } else {
            deepestElement = null;
        }

        return deepestElement;
    },

    get last() {
        const lastElement = this.composition.getLastElement();
        return lastElement;
    }
});

Composition.define({
    createConstituentIterable() {
        return this.constituents;
    },

    createReversedConstituentIterable() {
        return this.constituents.reverse();
    },

    createNextConstituentIterable(constituent) {
        const constituents = this.constituents;
        const index = constituents.indexOf(constituent);
        return constituents.slice(index + 1);
    },

    createPreviousConstituentIterable(constituent) {
        const constituents = this.constituents;
        const index = constituents.indexOf(constituent);
        return constituents.slice(0, index).reverse();
    },

    getFirstElement() {
        let firstElement;
        const composition = this;
        let constituentFirstElement;
        for (let constituent of composition.createConstituentIterable()) {
            constituentFirstElement = constituent.getFirstElement();
            if (constituentFirstElement) {
                break;
            }
        }
        firstElement = constituentFirstElement ? constituentFirstElement : null;
        return firstElement;
    },

    getLastElement() {
        let lastElement;
        const composition = this;
        // on pars du last constituent et on retourne le premier des constituent ayant un last element
        let constituentLastElement;
        for (let constituent of composition.createReversedConstituentIterable()) {
            constituentLastElement = constituent.getLastElement();
            if (constituentLastElement) {
                break;
            }
        }
        lastElement = constituentLastElement ? constituentLastElement : null;
        return lastElement;
    },

    getNextSiblingElementOf(element) {
        let nextSiblingElement;

        // first I have to find the element composant
        const constituent = element.link.constituent;
        const constituentNextSiblingElement = constituent.getNextSiblingElementOf(element);
        if (constituentNextSiblingElement) {
            nextSiblingElement = constituentNextSiblingElement;
        } else {
            let nextConstituentFirstElement;
            for (let nextConstituent of this.createNextConstituentIterable(constituent)) {
                nextConstituentFirstElement = nextConstituent.getFirstElement();
                if (nextConstituentFirstElement) {
                    break;
                }
            }
            nextSiblingElement = nextConstituentFirstElement || null;
        }

        return nextSiblingElement;
    },

    getPreviousSiblingElementOf(element) {
        let previousSiblingElement;

        // first I have to find the element composant
        const constituent = element.link.constituent;
        const constituentPreviousSiblingElement = constituent.getPreviousSiblingElementOf(element);
        if (constituentPreviousSiblingElement) {
            previousSiblingElement = constituentPreviousSiblingElement;
        } else {
            let previousConstituentLastElement;
            for (let previousConstituent of this.createPreviousConstituentIterable(constituent)) {
                previousConstituentLastElement = previousConstituent.getLastElement();
                if (previousConstituentLastElement) {
                    break;
                }
            }
            previousSiblingElement = previousConstituentLastElement || null;
        }

        return previousSiblingElement;
    }
});

Constituent.define({
    getFirstElement() {
        const elements = this.linkedElements;
        const length = elements.length;
        const firstElement = length === 0 ? null : elements[0];
        return firstElement;
    },

    getLastElement() {
        const elements = this.linkedElements;
        const length = elements.length;
        const lastElement = length === 0 ? null : elements[length - 1];
        return lastElement;
    },

    getNextSiblingElementOf(element) {
        const elements = this.linkedElements;
        const index = elements.indexOf(element);
        const nextSiblingElement = index === elements.length - 1 ? null : elements[index + 1];
        return nextSiblingElement;
    },

    getPreviousSiblingElementOf(element) {
        // now check if that composant got linkedElements
        const elements = this.linkedElements;
        // now check if there is a previous linkedElement
        const index = elements.indexOf(element);
        const previousSiblingElement = index === 0 ? null : elements[index - 1];
        return previousSiblingElement;
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

// use util.extend.call to avoid registering pointerElement in the Lab
const PointerElement = util.extend.call(Element, {
    constructor(pointedElement) {
        if (PointerElement.isPrototypeOf(pointedElement)) {
            pointedElement = pointedElement.pointedElement;
        }

        this.pointedElement = pointedElement;
        pointedElement.addPointer(this);

        this.value = pointedElement.value;
    }
});

Element.define({
    addPointer(pointer) {
        if (this.hasOwnProperty('pointers') === false) {
            this.pointers = [];
        }
        this.pointers.push(pointer);
    },
    pointers: []
});

Element.define({
    link: null,

    addChild(element) {
        // l'idée ici c'est de dire ok l'élement peut avoir des enfant, il faut donc créer un composant
        // de l'ajouter à la composition pour qu'on puisse utiliser ce composant
        const children = this.composition.ensure(ChildrenConstituent);
        return children.linkElement(element);
    }
});

const ChildrenConstituent = Constituent.extend({
    elementShortcut: 'children'
});

/*
At this point we have Lab, Element, Link that the core objects that we'll be used to describe any JavaScript value
*/

Lab.Element = Element;
Lab.Constituent = Constituent;
Lab.Link = Link;

export default Lab;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('iteration', function() {
            const element = Element.create();

            assert(element.parent === null);
            assert(element.first === null);
            assert(element.nextSibling === null);
            assert(element.prevSibling === null);
            assert(element.next === null);
            assert(element.prev === null);
            assert(element.last === null);
            assert(element.deepest === null);
            assert(element.depthless === null);

            const firstElement = Element.create();
            element.addChild(firstElement);
            const lastElement = Element.create();
            element.addChild(lastElement);
            const deepestElement = Element.create();
            lastElement.addChild(deepestElement);

            assert(element.first === firstElement);
            assert(element.last === lastElement);
            assert(firstElement.parent === element);
            assert(lastElement.parent === element);
            assert(firstElement.nextSibling === lastElement);
            assert(lastElement.prevSibling === firstElement);
            assert(element.deepest === deepestElement);
            assert(element.depthless === firstElement);

            // next
            assert(element.next === firstElement);
            assert(firstElement.next === lastElement);
            assert(lastElement.next === deepestElement);
            // prev
            assert(deepestElement.prev === lastElement);
            assert(lastElement.prev === firstElement);
            assert(firstElement.prev === element);
        });

        this.add('multiple link iteration', function() {
            const element = Element.create();
            const elementA = Element.create();
            const elementB = Element.create();
            const elementC = Element.create();
            const elementD = Element.create();

            // the new implementation suggests that element being part of constituent are not added
            // in the middle of the current list of element, they remain grouped by constituent
            element.addChild(elementA);
            const constituent = element.composition.compose();
            const link = constituent.link();
            link.add(elementB);
            link.add(elementC);
            element.addChild(elementD);

            assert(elementA.next === elementD);
            assert(elementB.next === elementC);
            assert(elementC.next === null);
            assert(elementD.next === elementB);

            assert(elementA.prev === element);
            assert(elementB.prev === elementD);
            assert(elementC.prev === elementB);
            assert(elementD.prev === elementA);
        });
    }
};
