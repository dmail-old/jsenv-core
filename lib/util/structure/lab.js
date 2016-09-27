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
const Linker = util.extend({
    constructor(element) {
        this.element = element;
        this.length = 0;
    },

    initialize() {

    },

    initializer() {

    },

    indexOf: Array.prototype.indexOf,
    find: Array.prototype.find,

    createLink(element) {
        return Link.create(element);
    },

    link(firstArg) {
        let link;

        if (Link.isPrototypeOf(firstArg)) {
            link = firstArg;
        } else {
            link = this.createLink(firstArg);
        }

        link.attach(this);

        return link;
    },

    unlink(element) {
        element.link.detach();
    },

    add(element) {
        this[this.length++] = element;
    },

    remove(element) {
        const index = this.indexOf(element);
        Array.prototype.splice(this, index, 1);
    }
});

const Link = util.extend({
    constructor(element) {
        if (Element.isPrototypeOf(element) === false) {
            throw new TypeError('Link constructor first argument must be an element');
        }

        this.element = element;
        element.link = this;
    },

    // by redefining attach & detach I may be able to create link which have more than one element, let's try
    attach(linker) {
        this.linker = linker;
        linker.add(this.element);
    },

    detach() {
        this.linker.remove(this.element);
    }
});

// define a way to link
/*
Link.define({
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
        let lastElement = this.element.last;

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
    },

    createTargetLink(element) {
        return this.createConstructor(element);
    }
});
*/

Element.define({
    link: null,
    linker: Linker.create(Element),

    addChild(firstArg) {
        if (this.hasOwnProperty('linker') === false) {
            this.linker = Linker.create(this);
        }

        this.linker.link(firstArg);
        return firstArg;
    }
});

Element.define({
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
            const list = parentElement.linker;
            const index = list.indexOf(this);
            prevSiblingElement = index === 0 ? null : list[index - 1];
        } else {
            prevSiblingElement = null;
        }

        return prevSiblingElement;
    },

    get parent() {
        const link = this.link;
        const parentElement = link ? link.linker.element : null;

        return parentElement;
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
        const list = this.linker;
        const length = list.length;
        const lastElement = length === 0 ? null : list[length - 1];

        return lastElement;
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
        const list = this.linker;
        const length = list.length;
        const firstElement = length === 0 ? null : list[0];

        return firstElement;
    },

    set first(element) {
        const list = this.linker;
        const link = list.createLink(element);
        list.unshift(link);
        return element;
    },

    get nextSibling() {
        let nextSiblingElement;

        const parentElement = this.parent;
        if (parentElement) {
            const list = parentElement.linker;
            const index = list.indexOf(this);
            nextSiblingElement = index === list.length - 1 ? null : list[index + 1];
        } else {
            nextSiblingElement = null;
        }

        return nextSiblingElement;
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

/*
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
*/

/*
At this point we have Lab, Element, Link that the core objects that we'll be used to describe any JavaScript value
*/

Lab.Element = Element;
Lab.Linker = Linker;
Lab.Link = Link;

export default Lab;

// unit test in the file are because that way they are as close as possible from what they are testing
// the next step would be to be able to declare unit test next to what they are testing
// right now they are always grouped together at the end of the file, it may change later to allow this

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
            const multipleElementLink = Link.extend({
                constructor() {

                },

                attach(linker) {
                    this.linker = linker;
                    elementB.link = this;
                    elementC.link = this;
                    linker.add(elementB);
                    linker.add(elementC);
                }
            });
            multipleElementLink.create();
            element.addChild(elementA);
            element.addChild(multipleElementLink);
            element.addChild(elementD);

            assert(elementA.prev === element);
            assert(elementB.prev === elementA);
            assert(elementC.prev === elementB);
            assert(elementD.prev === elementC);

            assert(elementA.next === elementB);
            assert(elementB.next === elementC);
            assert(elementC.next === elementD);
            assert(elementD.next === null);
        });
    }
};
