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
        Lab.register(Element, this);
        return Element;
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
We kown that some element will need to be linked with other element(s)
So we prepare a linker object responsible to link two element together
*/
const Link = util.extend({
    constructor() {
        this.length = 0;
    },

    attach(element) {
        this.element = element;
    },

    initialize() {

    },

    initializer() {

    },

    indexOf: Array.prototype.indexOf,
    find: Array.prototype.find,

    add(link) {
        if (this.isPrototypeOf(link)) {
            this[this.length++] = link;
        } else {
            throw new TypeError('Link.add first argument must be a link');
        }
    },

    remove(link) {
        const index = this.indexOf(link);
        Array.prototype.splice(this, index, 1);
    }
});

Element.define({
    link: null
});

// define a way to link
Link.define({
    connect(value) {
        const targetElement = this.createTargetElement(value);
        const targetLink = this.Link.create(targetElement);

        this.add(targetLink);

        return targetLink;
    },

    createTargetElement(value) {
        const Element = Lab.findElementByValueMatch(value);

        let previousElementUsingSameValue;
        if (Element.referencable) {
            previousElementUsingSameValue = this.findPreviousElementByValue(value);
        }

        let element;
        if (previousElementUsingSameValue) {
            console.log('make element a pointer on', value);
            element = PointerElement.create(previousElementUsingSameValue);
            // element.link = this;
        } else {
            element = Element.create();
            // element.link = this;
            element.initialize(value);
        }

        return element;
    },

    findPreviousElementByValue(value) {
        let previousElementUsingSameValue;
        let previousElement;
        let lastElement = this.lastElement;

        if (lastElement) {
            previousElement = lastElement;
        } else {
            previousElement = this.element;
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
    }
});

/* we need to be able to iterate elements from current to previous */
Link.define({
    get lastElement() {
        let lastElement;

        const lastLink = this.last;
        if (lastLink) {
            lastElement = lastLink.element.last;
        } else {
            lastElement = null;
        }

        return lastElement;
    },

    get last() {
        const list = this;
        return list[list.length - 1];
    },

    getPreviousElement(element) {
        let previousLinkLastElement;

        const previousLink = this.prevLink(element.link);
        if (previousLink) {
            previousLinkLastElement = previousLink.lastElement;
        } else {
            previousLinkLastElement = null;
        }

        return previousLinkLastElement;
    },

    prevLink(link) {
        const list = this;
        const index = list.indexOf(link);

        if (index === -1) {
            throw new Error('cannot get prev link of ' + link + ' : its not part of the list');
        }
        let prev;
        if (index === 0) {
            prev = null;
        } else {
            prev = list[index - 1];
        }
        return prev;
    }
});

Element.define({
    createPreviousElementIterable() {
        let element = this;

        return createIterable(function() {
            let previousElement = element.previous;
            element = previousElement;

            const result = {
                done: !previousElement,
                value: previousElement
            };

            return result;
        });
    },

    get previous() {
        let previous;

        const link = this.link;
        if (link) {
            const elementBefore = link.getPrevElement(this);
            if (elementBefore) {
                previous = elementBefore.last || elementBefore;
            } else {
                previous = link.element;
            }
        } else {
            previous = null;
        }

        return previous;
    },

    get last() {
        // à définir pour chaque élément
        return null;
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

/* iteration from an elemnt to the nexts */
Link.define({
    getNextElement(element) {
        let nextLinkFirstElement;

        const nextLink = this.nextLink(element.link);
        if (nextLink) {
            nextLinkFirstElement = nextLink.firstElement;
        } else {
            nextLinkFirstElement = null;
        }

        return nextLinkFirstElement;
    },

    nextLink(link) {
        const list = this;
        const index = list.indexOf(link);

        if (index === -1) {
            throw new Error('cannot get next link of ' + link + ' : its not part of the list');
        }
        const length = list.length;
        let next;
        if (index === length - 1) {
            next = null;
        } else {
            next = list[index + 1];
        }
        return next;
    },

    get firstElement() {
        let firstElement;

        const firstLink = this.first;
        if (firstLink) {
            firstElement = firstLink.element.first;
        } else {
            firstElement = null;
        }

        return firstElement;
    },

    get first() {
        return this[0];
    }
});

Element.define({
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

        let firstElement = this.firstElement;
        if (firstElement) {
            next = firstElement;
        } else {
            // search if there is an element after this one
            let link = this.link;

            if (link) {
                const afterElement = link.getNextElement(this);
                if (afterElement) {
                    next = afterElement;
                } else {
                    // search if a parent element got element after themselves
                    let currentElement = link.element;

                    while (true) { // eslint-disable-line
                        let currentLink = currentElement.link;
                        if (currentLink) {
                            const afterElement = currentLink.getNextElement(currentElement);
                            if (afterElement) {
                                next = afterElement;
                                break;
                            } else {
                                currentElement = currentLink.element;
                            }
                        } else {
                            next = null;
                            break;
                        }
                    }
                }
            } else {
                next = null;
            }
        }

        return next;
    },

    get first() {
        return null;
    }
});

/*
At this point we have Lab, Element, Link that the core objects that we'll be used to describe any JavaScript value
*/

Lab.Element = Element;
Lab.Link = Link;

export default Lab;

// unit test in the file are because that way they are as close as possible from what they are testing
// the next step would be to be able to declare unit test next to what they are testing
// right now they are always grouped together at the end of the file, it may change later to allow this

export const test = {
    modules: ['@node/assert'],

    main() {

    }
};
