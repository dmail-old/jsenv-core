/* eslint-disable no-use-before-define */

/*

to read : http://raganwald.com/2015/12/31/this-is-not-an-essay-about-traits-in-javascript.html

http://peterseliger.blogspot.fr/2014/04/the-many-talents-of-javascript.html#the-many-talents-of-javascript
https://en.wikipedia.org/wiki/Entity_component_system
Entity component system hold a list of components which is exactly what composition object was used first
http://www.radicalfishgames.com/?p=1725
http://web.archive.org/web/20160204143359/http://jsperf.com/prototypal-performance/234
-> what is shows is that module pattern is quite slow, if you cache or use prototype it's ok
so module pattern without caching function is the most handy because no this involved
and you can have private variable thanks to the scope but the impact on perf is non negligible
-> https://www.quora.com/What-is-the-performance-difference-between-the-module-pattern-and-other-object-creation-patterns

// and because skill.self is called once, it may be later redefined to sthing else without problem
// skill.global same, it may de redefined to something else wo impacting skill
// skill.local however should not be redefined during the call to self or global
Skill.create({
    method() {
        // a method belong to skill, nothing special to say about this one
        // it's just a normal method belonging to the skill but the preferred way to add method is through self()
    },

    // maybe add self that allows you to create methods available on self
    // just for convenience, not having to do it yourself (see method above) or wrap into IIFE
    static() {
        var test = '';

        return {
            method() {
                console.log(test);
            }
        };
    },

    prototype(skill) {
        // you can create private variables related to how subject & skill behave together
        var test = '';

        // and return a list of properties that will be defined on subject and need access to skill class
        return {
            subjectMethodHavingAccessOnSKill() {
                return skill.method();
            }
        };
    },

    instance(skill) {
        // create properties that will be defined on subject and need access to skill instance
        // even if I may not need subject here, I may need it for now keep like that but
        // remember that subject is accessible doing this.subject, we could prevent this by repacing
        // talent.local by skill.local if we really don't want subject to be acessible

        return {
            subjectMethodHavingAccessOnSKillInstance() {
                return skill.method();
            }
        };
    }
});

keywords :
Trait, Talent, Composable, Component, Mixin, Unit, Behaviour, Subject, Target
Reuse, Evolve, Combine, Composition
Skill, Competence, Education, Formation, Ability, Capacity, Experience, Teach, Learn, Train
Talent management, Needs, Task, Goal
Evaluation, Performance, Potential

A set of skill makes you competent to do something
In other words a competence is a combination of skills and use skills
Competence include abilities, behaviour and knowledge of how to use a skill to achieve the goal

*/

import util from './util.js';

const Properties = util.extend({
    conflictResolution: {},

    constructor(strategy) {
        this.map = {};
        this.strategy = strategy || {};
    },

    populateByFunctionCallReturn(fn, bind, args) {
        const returnValue = fn.apply(bind, args);
        if (returnValue) {
            this.populatebyObject(returnValue);
        }
    },

    populatebyObject(object) {
        Object.keys(object).forEach(function(name) {
            this.set(name, Object.getOwnPropertyDescriptor(object, name));
        }, this);
    },

    set(name, attributes) {
        this.map[name] = Property.create(name, attributes);
    },

    resolve(conflictResolution) {
        const resolvedProperties = Object.create(this);
        resolvedProperties.conflictResolution = Object.assign({}, this.conflictResolution, conflictResolution);
        return resolvedProperties;
    },

    concat(properties) {
        const concatenedProperties = this.createConstructor();
        Object.assign(concatenedProperties.map, this.map, properties.map);
        Object.assign(concatenedProperties.strategy, this.strategy, properties.strategy);
        return concatenedProperties;
    },

    link(subject) {
        var propertiesLink = [];
        propertiesLink.unlink = function() {
            this.forEach(function(propertyLink) {
                propertyLink.unlink();
            });
        };

        Object.keys(this.map).forEach(function(name) {
            const property = this.map[name];
            const propertyLink = this.linkProperty(subject, property);
            if (propertyLink) {
                propertiesLink.push(propertyLink);
            }
        }, this);

        return propertiesLink;
    },

    linkProperty(subject, property) {
        const propertyLink = {};
        const name = property.name;
        const conflictResolution = this.conflictResolution;

        // maybe we should do name in subject
        // and to get the currentProperty do something like while !hasOwnProperty Object.getPrototypeOf()
        if (subject.hasOwnProperty(name)) {
            let existingProperty = Property.create(name, Object.getOwnPropertyDescriptor(subject, name));
            let resolver;
            if (name in conflictResolution) {
                let resolutionValue = conflictResolution[name];

                if (typeof resolutionValue === 'string') {
                    if (resolutionValue === 'replace') {
                        resolver = resolvers.replace;
                    } else if (resolutionValue === 'remove') {
                        resolver = resolvers.remove;
                    } else if (resolutionValue === 'before') {
                        resolver = resolvers.before;
                    } else if (resolutionValue === 'after') {
                        resolver = resolvers.after;
                    } else {
                        resolver = resolvers.unexpectedString;
                    }
                } else if (typeof resolutionValue === 'object') {
                    if ('rename' in resolutionValue) {
                        resolver = resolvers.rename(resolutionValue.rename);
                    } else if ('around' in resolutionValue) {
                        resolver = resolvers.around(resolutionValue.around);
                    } else {
                        resolver = resolvers.unexpectedObject;
                    }
                } else {
                    resolver = resolvers.unexpectedValue;
                }
            } else {
                resolver = resolvers.missing;
            }

            resolver(subject, existingProperty, property);
            propertyLink.unlink = function() {
                existingProperty.define(subject);
            };
        } else {
            propertyLink.unlink = function() {
                delete subject[name];
            };
        }

        return propertyLink;
    }
});

const Property = util.extend({
    constructor(name, attributes) {
        this.name = name;
        this.attributes = attributes;
    },

    define(target, name, attributes) {
        const length = arguments.length;
        if (length < 2) {
            attributes = this.attributes;
            if (length < 1) {
                name = this.name;
            }
        }

        if (attributes) {
            Object.defineProperty(target, name, attributes);
        } else {
            delete target[name];
        }
    },

    describe(attributes) {
        const property = this.createConstructor(this.name, attributes);
        return property;
    },

    delete() {
        const property = this.createConstructor(this.name);
        return property;
    }
});

// think about maybe letting property as conflictual and manually resolve conflict
// using a strategy, if conflict is not manually resolved
// then we'll throw that's how traits.js is doing:  https://howtonode.org/traitsjs
// and the recommended way to handle conflict with Talent as state : http://peterseliger.blogspot.fr/2014/04/the-many-talents-of-javascript.html#the-many-talents-of-javascript
// because iddylic to consider that conflict may be resolved automagically
// and even if they could it's better to see how they are resolved instead of having to learn magic
// see also how conflict are resolved here : https://www.npmjs.com/package/simple-traits
// I would love something like
/*
Talent.compose(talentA, talentB); -> throw error
const talentAResolver = {
    a: {
        rename: 'prefixedA'
    },
    b: 'remove',
    c: 'before',
    d: 'after',
    e: {
        around(previousTalentMethod, talentMethod) {
            previousTalentMethod();
            console.log('around');
            return talentMethod();
        }
    },
    f: 'replace'
};

const talentAResolved = Talent.resolve(talentA, talentAResolver);
Talent.compose(talentA, talentB); // assuming resolver is correct, it's now ok

a last word too : there is conflict when doing Talent.compose but also when doing
Talent.link(skill, subject) because subject may already have
properties on it which will conflict with skill
we could make everything a skill so that we end up using only
Talent.create(), Talent.compose() & Talent.resolve() this is the simpler way I see to
extend conflict detection to non talent object (subject)
or when doing Talent.link() is the first argument is not a skill
then it cannot be resolved but that's not a prob: we can resolve the second argument (the skill)
it would require a last resolution keyword: replace: true that allow skill to replace the previous skill property

https://github.com/CocktailJS/cocktail/blob/master/lib/processor/annotation/Traits.js#L86
-> it suggest only method are supported in talent?
*/
const resolvers = {
    unexpectedString(subject, existingProperty) {
        throw new Error(
            'conflict resolver for property ' + existingProperty.name +
            ' string must be oneOf replace,remove,before,after'
        );
    },
    unexpectedObject(subject, existingProperty) {
        throw new Error(
            'conflict resolver for property ' + existingProperty.name +
            ' object must have oneOf rename,around properties'
        );
    },
    unexpectedValue(subject, existingProperty) {
        throw new Error(
            'conflict resolver for property ' + existingProperty.name +
            ' must be a string or an object'
        );
    },
    missing(subject, existingProperty) {
        throw new Error('unhandled conflict for property ' + existingProperty.name);
    },
    around(around) {
        return function(subject, existingProperty, property) {
            return property.define(subject, property.name, {
                value: function() {
                    return around(
                        existingProperty.attributes.value,
                        property.attributes.value,
                        arguments
                    );
                }
            });
        };
    },
    after(subject, existingProperty, property) {
        // execute property after existing
        return property.define(subject, property.name, {
            value: composeFunction(
                existingProperty.attributes.value,
                property.attributes.value,
                'after'
            )
        });
    },
    before(subject, existingProperty, property) {
        // execute property before existing
        return property.define(subject, property.name, {
            value: composeFunction(
                existingProperty.attributes.value,
                property.attributes.value,
                'before'
            )
        });
    },
    remove() {
        // ignore property, leave existingProperty
    },
    replace(subject, existingProperty, property) {
        // replace existingProperty by property
        return property.define(subject);
    },
    rename(newName) {
        // here is new name does conflict we must do something

        // let renameWith = resolverValue.rename;
        //             if (subject.hasOwnProperty(name)) {
        //                 // we must handle conflict of the renamed property
        //                 // maybe it's already handled for us inside resolver maybe it will throw because the conflict
        //                 // has no resolution strategy
        //                 // in short :  it's recursive
        //             }

        return function(subject, existingProperty, property) {
            // use an other name, if this name also exists un subject we must throw
            return property.define(subject, newName);
        };
    }
};

function composeFunction(composedFn, fn, when) {
    if (when === 'before') {
        return function() {
            let args = arguments;
            fn.apply(this, args);
            return composedFn.apply(this, args);
        };
    }
    if (when === 'after') {
        return function() {
            let args = arguments;
            composedFn.apply(this, args);
            return fn.apply(this, args);
        };
    }
    if (when === 'around') {
        return function() {
            return fn.call(this, composedFn, fn, arguments, this);
        };
    }
}

const StaticProperties = Properties.extend({
    name: 'static',
    conflictResolution: {}
});
const PrototypeProperties = Properties.extend({
    name: 'prototype',
    conflictResolution: {}
});
const InstanceProperties = Properties.extend({
    name: 'instance',
    conflictResolution: {}
});

const DefaultTalent = util.extend({
    static: function() {
        return null;
    },

    prototype() {
        return null;
    },

    instance() {
        return null;
    }
});

const linkTalentSymbol = Symbol();
const resolveTalentSymbol = Symbol();
const Talent = {
    create(definition) {
        const talent = DefaultTalent.create();
        if (definition) {
            Object.assign(talent, definition);
        }

        const staticProperties = StaticProperties.create();
        staticProperties.populateByFunctionCallReturn(talent.static, talent);
        talent.static = staticProperties;
        staticProperties.link(talent);

        const prototypeProperties = PrototypeProperties.create();
        prototypeProperties.populateByFunctionCallReturn(talent.prototype, talent);
        talent.prototype = prototypeProperties;

        return talent;
    },

    link(talent, subject, ...args) {
        if (linkTalentSymbol in talent) {
            return talent[linkTalentSymbol](subject, ...args);
        }

        let prototypeProperties = talent.prototype;
        let subjectProperties;
        const ownInstanceMethod = getTalentOwnInstanceMethod(talent);
        if (ownInstanceMethod) {
            const linkedTalent = Object.create(talent);
            linkedTalent.subject = subject;
            const instanceProperties = InstanceProperties.create();
            instanceProperties.populateByFunctionCallReturn(ownInstanceMethod, linkedTalent);
            linkedTalent.instance = instanceProperties;
            subjectProperties = prototypeProperties.concat(instanceProperties);
        } else {
            subjectProperties = prototypeProperties;
        }

        // using a separated object (subjectPropertiesLink) prevent memory from keeping in memory how to
        // remove a talent properties when nothing keep a reference to it
        const subjectPropertiesLink = subjectProperties.link(subject);
        return subjectPropertiesLink;
    },

    resolve(talent, resolvers) {
        if (resolveTalentSymbol in talent) {
            return talent[resolveTalentSymbol](resolvers);
        }

        // right now the resolvedTalent is just an instance of the talent with a different resolver
        // maybe we should clone the talent instead of instantiate it
        const resolvedTalent = Object.create(talent);
        if ('prototype' in resolvers) {
            resolvedTalent.prototype = resolvedTalent.prototype.resolve(resolvers.prototype);
        }
        if ('instance' in resolvers) {
            resolvedTalent.prototype = resolvedTalent.instance.resolve(resolvers.instance);
        }
        return resolvedTalent;
    },

    concat(...talents) {
        const list = TalentList.create(...talents);
        return list;
    }
};

function getTalentOwnInstanceMethod(talent) {
    const instanceMethod = talent.instance;
    let ownInstanceMethod;
    if (instanceMethod === DefaultTalent.instance) {
        ownInstanceMethod = undefined;
    } else {
        ownInstanceMethod = instanceMethod;
    }
    return ownInstanceMethod;
}

const TalentList = util.extend({
    constructor(...talents) {
        this.talents = talents;

        // right considering what I said earlier, only talent without custom instance() method
        // can be concatened, so we can concat talent prototype properties together and use this concatened version
        // BUT we still want to allow concatenation of talent with custom instance by doing
        // Talent.concat(a, b); if a and b got instance method
        // then it will throw :
        // because properties defined by talent may depend on subject you must provide a first theoric resolution
        // let's show with example

        /*
        const talentA = Talent.create({
            instance(talent) {
                return {
                    foo() {}
                };
            }
        });
        const talentB = Talent.create({
            instance() {
                return {
                    foo() {}
                };
            }
        });
        const talentC = Talent.concat(talentA, talentB);
        // program will throw 'Cannot concat talent with instance methods, please provide an explicit instance resolution strategy'
        // we know there is no explicit resolution strategy because Talent.resolve was never called on talentB
        // here we know (as a developper) that talentB foo will conflict with talentA foo
        // we must explicitely resolve the conflict during concatenation
        // it's still not clear if during instance() we should let an access on talent subject
        // if we do that we could build different properties depending on subject passed
        // I'm not sure we want to encourage this type of behaviour
        // if we are sure subject is not accessible we can assume that calling Talent.link(talentA, {});
        // will always create the same properties for a given talent
        // so we'll know that if two talents are still in conflict during Talent.link
        // it's because the call to Talent.resolve did not resolve conflict between talentA & talentB
        // I have to investigate on this
        // maybe we'll go for the solution where concat would call talent.instance to list properties
        // and check talent.instance.length to see if it's a promoted talent
        // or maybe we'll consider that every conflict occuring inside talent.instance must be resolved
        // per call to Talent.link
        Talent.concat(talentA, Talent.resolve(talentB, {instance: {foo: 'replace'}});

        */
    },

    [linkTalentSymbol](subject, ...args) {
        const link = {
            list: this.talents.map(function(talent) {
                return Talent.link(talent, subject, ...args);
            }),

            unlink() {
                this.list.forEach(function(link) {
                    link.unlink();
                });
            }
        };
        return link;
    },

    [resolveTalentSymbol](conflictResolution) {
        // all skills must now use the new resolver
        const resolvedTalentList = Object.create(this);

        resolvedTalentList.talents = this.skills.map(function(talent) {
            return Talent.resolve(talent, conflictResolution);
        });

        return resolvedTalentList;
    }
});

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('Pure talent', function() {
            const boundaryEnumerationTalent = Talent.create({
                prototype() {
                    return {
                        first() {
                            return this[0];
                        },

                        last() {
                            return this[this.length - 1];
                        }
                    };
                }
            });
            const list = ['a', 'b'];
            const listBoundaryTalent = Talent.link(boundaryEnumerationTalent, list);
            const arrayBoundaryTalent = Talent.link(boundaryEnumerationTalent, Array.prototype);

            assert(list.first === Array.prototype.first); // they share the same method
            assert(list.first() === 'a'); // method returns the expected value
            assert(list.last() === 'b');

            arrayBoundaryTalent.unlink();
            assert(Array.prototype.hasOwnProperty('first') === false); // removing the competence restore old properties
            listBoundaryTalent.unlink();
            assert(list.hasOwnProperty('last') === false);
        });

        this.add('conflict resolution : after, before', function() {
            const floatTalent = Talent.create({
                prototype() {
                    return {
                        move() {
                            this.floating = true;
                        }
                    };
                }
            });

            const rideTalent = Talent.create({
                prototype() {
                    return {
                        move() {
                            this.riding = true;
                        }
                    };
                }
            });
            const target = {};
            Talent.link(floatTalent, target);
            Talent.link(Talent.resolve(rideTalent, {move: 'before'}), target);

            target.move();
            // even if floatSkill is added before rideSKill, move() rides before float
            assert(Object.keys(target).join(), 'move,riding,floating');
        });

        this.add('promoted talent', function() {
            // this is a promoted talent because it relies on an additional injected object (list)
            // which is a private state of subject and this is expected to be accessed by scope
            const randomItemTalent = Talent.create({
                static: function() {
                    return {
                        parseFloat: global.parseFloat,
                        mathFloor: global.Math.floor
                    };
                },

                instance(talent, list) {
                    return {
                        item(index) {
                            return list[talent.mathFloor(talent.parseFloat(index, 10))];
                        }
                    };
                }
            });

            const tempTalent = Talent.create({
                static: function() {
                    return {
                        arrayFrom: Array.from
                    };
                },

                instance(talent, list) {
                    return {
                        toArray() {
                            return talent.arrayFrom(list);
                        },
                        valueOf() {
                            return this.toArray();
                        },
                        toString() {
                            return String(list);
                        },
                        size() {
                            return list.length;
                        }
                    };
                }
            });

            const allocateTalent = Talent.concat(randomItemTalent, tempTalent);

            const Queue = util.extend({
                constructor() {
                    var list = [];

                    this.define({
                        enqueue(type) {
                            list.push(type);
                            return type;
                        },

                        dequeue() {
                            return list.shift();
                        }
                    });

                    Talent.link(allocateTalent, this, list);
                }
            });
            // as we can see the implementation of queue creates two function for every queue
            // it's the only way to keep list private but we also notice that
            // thanks to skill & talent properties which are not directly related to the implementation of queue
            // does not have to be recreated they are just assigned on the list object
            const q = Queue.create();

            q.enqueue("the");
            q.enqueue("quick");
            q.enqueue("brown");
            q.enqueue("fox");
            assert(q.size() === 4);
            assert(q.toArray().join() === 'the,quick,brown,fox');
            assert(q.item(1) === 'quick');

            q.dequeue();
            q.dequeue();
            assert(q.toArray().join() === 'brown,fox');
            assert(q.size() === 2);

            q.dequeue();
            q.dequeue();
            q.dequeue();
            assert(q.size() === 0);
        });

        /*
        // skilled talent don't change anything IMO however we must add test about global() local() etc
        this.add('skilled talent', function() {
            // same as promoted but creates his own state and mutates it
            const ObservableSkill = (function() {
                const Event = util.extend({
                    constructor(target, type) {
                        this.target = target;
                        this.type = type;
                    }
                });

                const EventListener = util.extend({
                    constructor(target, type, handler) {
                        this.defaultEvent = new Event(target, type);
                        this.handler = handler;
                    },

                    handleEvent(event) {
                        if (event && typeof event === "object") {
                            event.target = this.defaultEvent.target;
                            event.type = this.defaultEvent.type;
                        } else {
                            event = {
                                target: this.defaultEvent.target,
                                type: this.defaultEvent.type
                            };
                        }
                        this.handler(event);
                    },

                    getType() {
                        return this.defaultEvent.type;
                    },

                    getHandler() {
                        return this.handler;
                    }
                });

                // here we are exactly in the case where perf may be vastly improved
                // we have to resort to dynamicProperties because of the private eventMap at the top
                // but eventMap completely belongs to skill and as a consequence, if skill was accessible from
                // the subject it would eliminates the need to have dynamicProperties
                const EventTargetSkill = Skill.create({ // implementing the [EventTarget] Mixin as "skillful" Talent.
                    instance(skill) {
                        var eventMap = {};

                        return {
                            addEventListener(type, handler) {      // will trigger creation of new state.
                                var reference;
                                var event = eventMap[type];
                                var listener = EventListener.create(this, type, handler);
                                if (event) {
                                    var handlers = event.handlers;
                                    var listeners = event.listeners;
                                    var idx = handlers.indexOf(handler);

                                    if (idx === -1) {
                                        handlers.push(listener.getHandler());
                                        listeners.push(listener);
                                        reference = listener;
                                    } else {
                                        reference = listeners[idx];
                                    }
                                } else {
                                    event = eventMap[type] = {};
                                    event.handlers = [listener.getHandler()];
                                    event.listeners = [listener];

                                    reference = listener;
                                }
                                return reference;
                            },

                            dispatchEvent(event) {
                                var successfully = false;
                                event = eventMap[event.type];

                                if (event) {
                                    var listeners = event.listeners;
                                    var len = listeners.length;
                                    var idx = -1;

                                    if (len >= 1) {
                                        while (++idx < len) {
                                            listeners[idx].handleEvent(event);
                                        }
                                        successfully = true;
                                    }
                                }
                                return successfully;
                            }
                        };
                    }
                });

                // we could benefit from sharing properties if we have a way to access
                // the skill from the subject
                const StaticEventTargetSkill = Skill.create({
                    static() {
                        return {
                            method() {
                                console.log(this.subject);
                            }
                        };
                    },

                    prototype(skill) {
                        // here you may want to define some helper specific to the skill
                        // instead of putting them on skill. you may use scope which is recommended
                        // but you cannot access them in local() of course

                        return {
                            callStaticMethod() {
                                return skill.method();
                            },

                            // you may enable something cool which impact perf if you define methods in global()
                            // but in fact they have an acess to skill instance using a property
                            // as you can see in the local function below subject.observale === skill instance
                            callInstanceMethod() {
                                return this.observable.method();
                            }
                        };
                    },

                    instance(skill) {
                        // here we can instantiate some stuff specific to the instance
                        this.eventMap = {};

                        return {
                            observable: skill,

                            callInstanceMethod() {
                                return skill.method();
                            }
                        };
                    }
                });

                return StaticEventTargetSkill;
            })();

            const subject = {};
            ObservableSkill.augment(subject);
            console.log(subject);
        });
        */
    }
};
