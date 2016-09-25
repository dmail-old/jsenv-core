/* eslint-disable no-use-before-define */

import util from './util.js';

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
So we prepare a link property and a Link object
*/
Element.define({
    link: null
});

const Link = util.extend({
    constructor(element) {
        this.element = element;
    },
    element: null
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

    get firstElement() {
        return null;
    },

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
                previous = elementBefore.lastElement || elementBefore;
            } else {
                previous = link.element;
            }
        } else {
            previous = null;
        }

        return previous;
    },

    get lastElement() {
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

Link.define({
    get firstElement() {
        return this.target.firstElement;
    },

    getNextElement(element) {
        return this.target.getNextElement(element);
    },

    get lastElement() {
        return this.target.lastElement;
    },

    getPrevElement(element) {
        return this.target.getPrevElement(element);
    }
});

const LinkTarget = util.extend();
const LinkTargetList = util.extend();

LinkTargetList.define({
    constructor() {
        this.length = 0;
    },

    Link: Link,
    indexOf: Array.prototype.indexOf,
    find: Array.prototype.find,

    add(link) {
        if (this.Link.isPrototypeOf(link)) {
            this[this.length++] = link;
        } else {
            throw new TypeError('LinkList except a link or the right type');
        }
    },

    remove(link) {
        const index = this.indexOf(link);
        Array.prototype.splice(this, index, 1);
    }
});

/* prepare iteration from a link to next elements */
LinkTarget.define({
    getNextElement(/* element */) {
        return null;
    },

    get firstElement() {
        return this.element;
    },

    getPrevElement(/* element */) {
        return null;
    },

    get lastElement() {
        return this.element;
    }
});

/*
LinkTarget peut être dans une LinkTargetList et dans ce cas
getNextElement doit se ballader dans la liste
*/
LinkTargetList.define({
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
            firstElement = firstLink.firstElement;
        } else {
            firstElement = null;
        }

        return firstElement;
    },

    get first() {
        return this[0];
    },

    get lastElement() {
        let lastElement;

        const lastLink = this.last;
        if (lastLink) {
            lastElement = lastLink.lastElement;
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

Link.define({
    createTarget() {
        const args = arguments;
        const length = args.length;

        let target;
        if (length === 0) {
            throw new Error();
        } else if (length === 1) {
            target = LinkTarget.create();
            target.initialize(args[0]);
        } else {
            target = LinkTargetList.create();
            let i = 0;
            while (i < length) {
                target.add(args[i]);
                i++;
            }
        }

        return target;
    }
});

 // const Element = Lab.findElementByValueMatch(value);

 //        let previousElementUsingSameValue;
 //        if (Element.referencable) {
 //            previousElementUsingSameValue = this.findPreviousElementByValue(value);
 //        }

 //        let element;
 //        if (previousElementUsingSameValue) {
 //            console.log('make element a pointer on', value);
 //            element = PointerElement.create(previousElementUsingSameValue);
 //            element.link = this;
 //        } else {
 //            element = Element.create();
 //            element.link = this;
 //            element.initialize(value);
 //        }

/*
our objects are ready but we are missing an important method allowing Link to create a linkedElement
and alongside we want to allow element to point other elements
*/
Link.define({
    createLinkedElement(value) {
        const Element = Lab.findElementByValueMatch(value);

        let previousElementUsingSameValue;
        if (Element.referencable) {
            previousElementUsingSameValue = this.findPreviousElementByValue(value);
        }

        let element;
        if (previousElementUsingSameValue) {
            console.log('make element a pointer on', value);
            element = PointerElement.create(previousElementUsingSameValue);
            element.link = this;
        } else {
            element = Element.create();
            element.link = this;
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
At this point we have Lab, Element, Link & LinkList that the core objects that we'll be used to describe any JavaScript value
*/

Lab.Element = Element;
Lab.Link = Link;
// Lab.LinkList = LinkList;

export default Lab;

// unit test in the file are because that way they are as close as possible from what they are testing
// the next step would be to be able to declare unit test next to what they are testing
// right now they are always grouped together at the end of the file, it may change later to allow this

export const test = {
    modules: ['@node/assert'],

    main() {

    }
};
