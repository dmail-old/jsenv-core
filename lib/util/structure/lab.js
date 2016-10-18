/* eslint-disable no-use-before-define */

// https://rjzaworski.com/2013/03/composition-in-javascript
// http://www.dofactory.com/javascript/composite-design-pattern

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

const Walker
*/

export const test = {
    modules: ['@node/assert'],

    main() {
        // let's first define what we need with this lab.js
        // we need something that will be used to represent js values
        // so le'ts first see how we would use it to represent js values
        // once we have this we'll be able to know what we need more precisely

        this.add('Lab create a custom element matching native js object & map', function() {
            // const ObjectMatcher = Lab.createMatcher(function(value) {
            //     return Object.prototype.isPrototypeOf(value);
            // });
            // const ObjectProducer = Lab.createProducer(function() {
            //     return {};
            // });
            // ObjectProperties have many features
            // we construct it on the fly using talent or whatever
            // the first aspect of objectProperties is that it holds a list of object using their name
            // it comes with several features such as map, has, get, set etc
            // const ObjectElement = Lab.createElement('Object', function() {
            //     this.matcher = ObjectMatcher;
            //     this.producer = ObjectProducer;
            //     this.properties = ObjectProperties.create();
            // });
            // const ObjectProperty = Lab.createComponent();
            // ObjectProperty.registerAsComponentOf(ObjectProperties);

            // il manque encore le fait qu'il faut caster property.descriptor.value ou property.descriptor.set/get
            // et aussi entry.value
            // ensuite le moyen d'itérer depuis une propriété / entry vers une autre

            const Talent = null;
            const NamedEnumerableTalent = Talent.create(function() {
                return {
                    local() {
                        return {
                            entries: {},

                            count() {
                                return Object.keys(this.entries).length;
                            },

                            has(name) {
                                return this.entries.hasOwnProperty(name);
                            },

                            get(name) {
                                return this.entries.hasOwnProperty(name) ? this.map[name] : null;
                            },

                            add(entry) {
                                this.entries[entry.name] = entry;
                            },

                            map(fn, bind) {
                                for (let entry of this) {
                                    let mappedEntry = fn.call(bind, entry);
                                    if (mappedEntry !== entry) {
                                        this.entries[mappedEntry.name] = mappedEntry;
                                    }
                                }
                            },

                            forEach(fn, bind) {
                                for (let entry of this) {
                                    fn.call(bind, entry);
                                }
                            },

                            [Symbol.iterator]() {
                                return Object.keys(this.entries).map(function(name) {
                                    return this.entries[name];
                                })[Symbol.iterator]();
                            }
                        };
                    },

                    prototype() {
                        return ['has', 'get', 'has', 'add', 'map', 'forEach', Symbol.iterator];
                    },

                    instance(local, prototype, subject, entries) {
                        local.entries = Object.create(local.entries);

                        if (entries) {
                            for (let entry of entries) {
                                local.add(entry);
                            }
                        }

                        return {
                            enumerable: local
                        };
                    }
                };
            });
            const CastableTalent = Talent.create(function() {
                return {
                    instance(local, prototype, subject, caster) {
                        return {
                            cast(...args) {
                                return caster.apply(this, args);
                            }
                        };
                    }
                };
            });

            const ObjectProperties = util.extend({
                constructor() {
                    this.enumerable = NamedEnumerableTalent.install(this, ObjectProperty);
                },

                seal() {
                    return this.map(function(property) {
                        return property.seal();
                    });
                },

                freeze() {
                    return this.map(function(property) {
                        return property.freeze();
                    });
                },

                define(subject) {
                    return this.forEach(function(property) {
                        property.define(subject);
                    });
                }
            });
            CastableTalent.install(ObjectProperties, function(object, deep) {
                const objectProperties = ObjectProperties.create();

                Object.keys(object).forEach(function(name) {
                    const property = ObjectProperty.create(name);
                    objectProperties.add(property);
                    property.populate(object);
                });

                if (deep) {
                    let objectAncestor = Object.getPrototypeOf(object);
                    while (objectAncestor) {
                        Object.keys(objectAncestor).forEach(function(name) { // eslint-disable-line
                            if (objectProperties.has(name) === false) {
                                const property = ObjectProperty.create(name);
                                objectProperties.add(property);
                                property.populate(objectAncestor);
                            }
                        });
                        objectAncestor = Object.getPrototypeOf(objectAncestor);
                    }
                }

                return objectProperties;
            });

            const ObjectProperty = util.extend({
                constructor(name) {
                    this.name = name;
                },
                object: null,

                define(object) {
                    const descriptor = this.descriptor;

                    if (descriptor) {
                        // console.log('define property', this.name, 'on', this.owner);
                        Object.defineProperty(object, this.name, descriptor);
                    } else {
                        delete object.owner[this.name];
                    }
                },

                populate(object) {
                    if (Object.prototype.isPrototypeOf(object) === false) { // object & function allowed
                        throw new TypeError('ObjectProperty caster first argument must inherit from Object.prototype');
                    }

                    const descriptor = Object.getOwnPropertyDescriptor(object, this.name);
                    this.object = object;
                    this.descriptor = descriptor;

                    if ('value' in descriptor) {
                        this.value = Element.scan(descriptor.value);
                    } else {
                        if ('get' in descriptor) {
                            this.get = Element.scan(descriptor.get);
                        }
                        if ('set' in descriptor) {
                            this.set = Element.scan(descriptor.set);
                        }
                    }
                }
            });

            const MapEntries = util.extend({
                constructor() {
                    this.enumerable = NamedEnumerableTalent.install(this);
                }
            });
            CastableTalent.install(MapEntries, function(map) {
                const mapEntries = MapEntries.create();

                for (let entry of map) {
                    mapEntries.add(MapEntry.cast(entry[0], entry[1]));
                }

                return mapEntries;
            });

            const MapEntry = util.extend({
                constructor(name) {
                    this.name = name;
                },
                map: null,
                value: undefined,

                define(map) {
                    map.set(this.name, this.value);
                }
            });
            CastableTalent.install(MapEntry, function(name, value) {
                const mapEntry = MapEntry.create(name);
                mapEntry.value = value;
                return mapEntry;
            });
        });

        /*
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
            constituent.add(elementB);
            constituent.add(elementC);
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
        */
    }
};

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
    constructor(owner) {
        // owner will be Element or Constituent, because we may have
        // an element having a list of constituent & a constituent may also have a list of constituent
        this.pure = false;
        this.owner = owner;

        const shortcut = this.ownerShortcut;
        if (shortcut) {
            owner[shortcut] = this;
        }
        this.ownerProperties.forEach(function(property) {
            owner[property] = this[property].bind(this);
        }, this);
        this[this.compositionName] = Composition.create(this);
        this.linkedElements = [];
    },

    pure: true,
    owner: null,
    ownerShortcut: '',
    ownerProperties: [],
    compositionName: 'composition'
});

// this object is responsible to handle the list of constituent of a composable (constituent or element)
const Composition = util.extend({
    constituents: [],
    pure: true,
    add(constituent) {
        this.constituents.push(constituent);
    },

    compose() {
        const constituent = this.createConstituent.apply(this, arguments);
        this.constituents.push(constituent);
        constituent.initialize(this.owner);
        return constituent;
    },

    createConstituent(CustomConstituent) {
        const constituent = (CustomConstituent || Constituent).create(this);
        return constituent;
    },

    ensure(Constituent) {
        let constituent = this.constituents.find(function(Constituent) {
            return Constituent.isPrototypeOf(constituent);
        });
        if (!constituent) {
            constituent = this.createConstituent(Constituent);
            this.constituents.push(constituent);
            constituent.initialize(this.owner);
        }
        return constituent;
    },

    constructor(owner) {
        this.owner = owner;
        this.pure = false;
        this.constituents = this.constituents.map(function(Constituent) {
            return Constituent.create(owner);
        }, this);
    },

    initiliazer() {
        this.constituents.forEach(function(constituent) {
            constituent.initialize(this.owner);
        }, this);
    }
});

Constituent.define({
    initialize() {
        this.initializer();
    },

    initializer() {

    },

    linkValue(value) {
        const element = this.createElement(value);
        return this.link(element);
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

        return element;
    },

    findPreviousElementByValue(value) {
        let previousElementUsingSameValue;
        let previousElement;
        let lastElement = this.getLastElement();

        if (lastElement) {
            previousElement = lastElement;
        } else {
            previousElement = this.getParentElement();
        }

        if (previousElement.value === value) {
            previousElementUsingSameValue = previousElement;
        } else {
            for (previousElement of previousElement.createPreviousIterable()) {
                if (previousElement.value === value) {
                    previousElementUsingSameValue = previousElement;
                    break;
                }
            }
        }

        return previousElementUsingSameValue;
    },

    link(element) {
        if (Element.isPrototypeOf(element) === false) {
            throw new TypeError('Constituent.link first argument must be an element');
        }

        const list = this.linkedElements;
        element.constituent = this;
        list.push(element);
        element.lifecycle.added();
    },

    unlink(element) {
        if (Element.isPrototypeOf(element) === false) {
            throw new TypeError('Constituent.unlink first argument must be an element');
        }

        const list = this.linkedElements;
        const index = list.indexOf(element);
        list.splice(index, 1);

        element.lifecycle.removed();
        element.constituent = null;
    },

    unlinkAll() {
        this.linkElement.forEach(function(element) {
            this.unlink(element);
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
// parent
Element.define({
    get parent() {
        let parentElement;
        const constituent = this.constituent;
        if (constituent) {
            parentElement = constituent.getParentElement();
        } else {
            parentElement = null;
        }
        return parentElement;
    }
});
Constituent.define({
    getParentElement() {
        let parentElement;
        let firstOwnerWhichIsNotAConstituent;
        for (let ancestorConstituent of this.createAncestorIterable()) {
            let ancestorConstituentOwner = ancestorConstituent.owner;
            if (Element.isPrototypeOf(ancestorConstituentOwner)) {
                firstOwnerWhichIsNotAConstituent = ancestorConstituentOwner;
                break;
            }
        }
        if (firstOwnerWhichIsNotAConstituent) {
            parentElement = firstOwnerWhichIsNotAConstituent;
        } else {
            parentElement = null;
        }
        return parentElement;
    },

    createAncestorIterable() {
        let constituent = this;

        return createIterable(function() {
            let parent = constituent.parent;
            constituent = parent;

            const result = {
                done: !parent,
                value: parent
            };

            return result;
        });
    }
});

// createNextIterable(), next, deepest, first, nextSibling
Element.define({
    createNextIterable() {
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
    }
    // set first(element) {
    //     const list = this.linker;
    //     const link = list.createLink(element);
    //     list.unshift(link);
    //     return element;
    // },
});
Composition.define({
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

    createConstituentIterable() {
        return this.constituents;
    }
});
Constituent.define({
    getFirstElement() {
        let firstElement;
        const elements = this.linkedElements;
        const length = elements.length;
        if (length === 0) {
            firstElement = this.composition.getFirstElement();
        } else {
            firstElement = elements[0];
        }
        return firstElement;
    }
});
Element.define({
    get nextSibling() {
        let nextSiblingElement;

        const parentElement = this.parent;
        if (parentElement) {
            nextSiblingElement = parentElement.composition.getNextSiblingElementOf(this);
        } else {
            nextSiblingElement = null;
        }

        return nextSiblingElement;
    }
});
Composition.define({
    getNextSiblingElementOf(element) {
        let nextSiblingElement;

        const constituent = element.constituent;
        const constituentNextSiblingElement = constituent.getNextSiblingElementOf(element);
        if (constituentNextSiblingElement) {
            nextSiblingElement = constituentNextSiblingElement;
        } else {
            let nextConstituentFirstElement;
            for (let nextConstituent of constituent.createNextIterable()) {
                nextConstituentFirstElement = nextConstituent.getFirstElement();
                if (nextConstituentFirstElement) {
                    break;
                }
            }
            nextSiblingElement = nextConstituentFirstElement || null;
        }

        return nextSiblingElement;
    }
});
Constituent.define({
    getNextSiblingElementOf(element) {
        let nextSiblingElement;
        const elements = this.linkedElements;
        const index = elements.indexOf(element);
        if (index === elements.length - 1) {
            nextSiblingElement = this.composition.getNextSiblingElementOf(element);
        } else {
            nextSiblingElement = elements[index + 1];
        }
        return nextSiblingElement;
    },

    createNextIterable() {
        const constituents = this.owner.constituents;
        const index = constituents.indexOf(this);
        return constituents.slice(index + 1);
    }
});

// createPreviousIterable(), prev, previousSibling, deepest, last
Element.define({
    createPreviousIterable() {
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
    }
});
Composition.define({
    getPreviousSiblingElementOf(element) {
        let previousSiblingElement;

        // first I have to find the element composant
        const constituent = element.constituent;
        const constituentPreviousSiblingElement = constituent.getPreviousSiblingElementOf(element);
        if (constituentPreviousSiblingElement) {
            previousSiblingElement = constituentPreviousSiblingElement;
        } else {
            let previousConstituentLastElement;
            for (let previousConstituent of constituent.createPreviousIterable()) {
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
Element.define({
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
Constituent.define({
    getPreviousSiblingElementOf(element) {
        let previousSiblingElement;
        const elements = this.linkedElements;
        const index = elements.indexOf(element);
        if (index === 0) {
            previousSiblingElement = this.composition.getPreviousSiblingElementOf(element);
        } else {
            previousSiblingElement = elements[index - 1];
        }
        return previousSiblingElement;
    },

    createPreviousIterable() {
        const constituents = this.owner.constituents;
        const index = constituents.indexOf(this);
        return constituents.slice(0, index).reverse();
    },

    getLastElement() {
        let lastElement;
        const elements = this.linkedElements;
        const length = elements.length;
        if (length === 0) {
            lastElement = this.composition.getLastElement();
        } else {
            lastElement = elements[length - 1];
        }
        return lastElement;
    }
});
Composition.define({
    getLastElement() {
        let lastElement;
        const composition = this;
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

    createReversedConstituentIterable() {
        return this.constituents.reverse();
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
    constituent: null,

    addChild(element) {
        // l'idée ici c'est de dire ok l'élement peut avoir des enfant, il faut donc créer un composant
        // de l'ajouter à la composition pour qu'on puisse utiliser ce composant
        const children = this.composition.ensure(ChildrenConstituent);
        return children.linkElement(element);
    }
});

const ChildrenConstituent = Constituent.extend({
    ownerShortcut: 'children'
});

/*
At this point we have Lab, Element, Link that the core objects that we'll be used to describe any JavaScript value
*/

Lab.Element = Element;
Lab.Constituent = Constituent;

export default Lab;
