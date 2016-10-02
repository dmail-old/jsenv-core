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

// skill has some property that may conflict with static property : constructor,static,prototype,instance,prototypeProperties
// they must not be used
const Skill = util.extend({
    prototypeProperties: [],

    constructor() {
        util.define.apply(this, arguments);
        const staticProperties = this.static();
        if (staticProperties) {
            util.define.call(this, staticProperties);
        }
        const prototypeProperties = this.prototype();
        if (prototypeProperties) {
            this.prototypeProperties = createPropertiesFromObject(prototypeProperties);
        }
    },

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

function createPropertiesFromObject(object) {
    return object ? Object.keys(object).map(function(name) {
        return Property.create(name, Object.getOwnPropertyDescriptor(object, name));
    }) : [];
}

const Property = util.extend({
    // think about maybe letting property as conflictual and manually resolve conflict
    // using a strategy, if conflict is not manually resolved
    // then we'll throw that's how traits.js is doing:  https://howtonode.org/traitsjs
    // and the recommended way to handle conflict with Talent as state : http://peterseliger.blogspot.fr/2014/04/the-many-talents-of-javascript.html#the-many-talents-of-javascript
    // because iddylic to consider that conflict may be resolved automagically
    // and even if they could it's better to see how they are resolved instead of having to learn magic
    // see also how conflict are resolved here : https://www.npmjs.com/package/simple-traits
    conflictStrategy: 'override',

    constructor(name, attributes) {
        this.name = name;
        this.attributes = attributes;
    },

    define(target) {
        let name = this.name;
        let attributes = this.attributes;

        if (target.hasOwnProperty(name)) {
            // for now I got 6 primary strategy : before, after, around, alias, override, skip
            // alias : put the method on a supposed non used property
            // override : execute me
            // skip : ignore this property
            // before : execute before the current
            // after : execute after the current
            // around : execute passing current as first arg, arguments as second and target as third to decide when to call it

            const conflictStrategy = this.conflictStrategy;
            if (conflictStrategy === 'throw') {
                throw new Error('subject already has a property named ' + name);
            } else if (conflictStrategy === 'skip') {
                // noop
            } else if (conflictStrategy === 'override') {
            } else if (conflictStrategy === 'alias') {
                name = 'an alias';
            } else {
                let targetValue = target[name];
                let skillValue = attributes ? attributes.value : undefined;

                if (typeof targetValue === 'function' && typeof skillValue === 'function') {
                    if (conflictStrategy === 'before') {
                        attributes = Object.assign(attributes, {
                            value: composeFunction(skillValue, targetValue, 'before')
                        });
                    } else if (conflictStrategy === 'after') {
                        attributes = Object.assign(attributes, {
                            value: composeFunction(skillValue, targetValue, 'after')
                        });
                    } else if (conflictStrategy === 'around') {
                        attributes = Object.assign(attributes, {
                            value: composeFunction(skillValue, targetValue, 'around')
                        });
                    }
                }
            }
        } else {
            // noop
        }

        return this.set(target, name, attributes);
    },

    set: function(target, name, attributes) {
        let previousProperty;

        if (target.hasOwnProperty(name)) {
            previousProperty = this.describe(Object.getOwnPropertyDescriptor(target, name));
        } else {
            previousProperty = this.delete();
        }

        if (attributes) {
            Object.defineProperty(target, name, attributes);
        } else {
            delete target[name];
        }

        return previousProperty;
    },

    describe(attributes) {
        // should inherit the conflict strategy
        const property = this.createConstructor(this.name, attributes);
        return property;
    },

    delete() {
        const property = this.createConstructor(this.name);
        return property;
    }
});

function composeFunction(fn, composedFn, when) {
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

const linkTalentSymbol = Symbol();
const Talent = {
    link(skill, subject, ...args) {
        if (linkTalentSymbol in skill) {
            return skill[linkTalentSymbol](subject, ...args);
        }

        const talent = Object.create(skill);
        talent.subject = subject;

        // using a separated object hook prevent memory from keeping in memory how to
        // remove a skill when nothing keep a reference to it
        var instanceProperties = createPropertiesFromObject(talent.instance(talent, ...args));
        const link = {
            prototypeProperties: defineProperties(skill.prototypeProperties, subject),
            instanceProperties: defineProperties(instanceProperties, subject),
            unlink() {
                defineProperties(this.prototypeProperties, subject); // will uselessly create a list of hook
                defineProperties(this.instanceProperties, subject); // will uselessly create a list of hook
            }
        };
        // const selfProperty = this.selfProperty;
        // if (selfProperty) {
        //     // it may conflict with other properties, in such case we would throw
        //     this.define(selfProperty.describe({value: this}));
        // }

        return link;
    },

    concat(...skills) {
        const list = SkillList.create(...skills);
        return list;
    }
};

function defineProperties(properties, object) {
    return properties.map(function(property) {
        return property.define(object);
    }, this);
}

const SkillList = util.extend({
    constructor(...skills) {
        this.skills = skills;
    },

    [linkTalentSymbol](subject, ...args) {
        const link = {
            list: this.skills.map(function(skill) {
                return Talent.link(skill, subject, ...args);
            }),

            unlink() {
                this.list.forEach(function(link) {
                    link.unlink();
                });
            }
        };
        return link;
    }
});

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('Pure talent', function() {
            const boundaryEnumerationSkill = Skill.create({
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
            const listBoundaryTalent = Talent.link(boundaryEnumerationSkill, list);
            const arrayBoundaryTalent = Talent.link(boundaryEnumerationSkill, Array.prototype);

            assert(list.first === Array.prototype.first); // they share the same method
            assert(list.first() === 'a'); // method returns the expected value
            assert(list.last() === 'b');

            arrayBoundaryTalent.unlink();
            assert(Array.prototype.hasOwnProperty('first') === false); // removing the competence restore old properties
            listBoundaryTalent.unlink();
            assert(list.hasOwnProperty('last') === false);
        });

        this.add('conflict resolution : after, before', function() {
            const floatSkill = Skill.create({
                prototype() {
                    return {
                        move() {
                            this.floating = true;
                        }
                    };
                }
            });
            floatSkill.prototypeProperties[0].conflictStrategy = 'after';
            const rideSkill = Skill.create({
                prototype() {
                    return {
                        move() {
                            this.riding = true;
                        }
                    };
                }
            });
            rideSkill.prototypeProperties[0].conflictStrategy = 'before';
            const target = {};
            Talent.link(floatSkill, target);
            Talent.link(rideSkill, target);

            target.move();
            // even if floatSkill is added before rideSKill, move() rides before float
            assert(Object.keys(target).join(), 'move,riding,floating');
        });

        this.add('promoted talent', function() {
            // this is a promoted talent because it relies on an additional injected object (list)
            // which is a private state of subject and this is expected to be accessed by scope
            const randomItemSkill = Skill.create({
                static: function() {
                    return {
                        parseFloat: global.parseFloat,
                        mathFloor: global.Math.floor
                    };
                },

                instance(skill, list) {
                    return {
                        item(index) {
                            return list[skill.mathFloor(skill.parseFloat(index, 10))];
                        }
                    };
                }
            });

            const tempSkill = Skill.create({
                static: function() {
                    return {
                        arrayFrom: Array.from
                    };
                },

                instance(skill, list) {
                    return {
                        toArray() {
                            return skill.arrayFrom(list);
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

            const allocateSkill = Talent.concat(randomItemSkill, tempSkill);

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

                    Talent.link(allocateSkill, this, list);
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
                    link() {
                        this.eventMap = {};
                        return Skill.link.apply(this, arguments);
                    },

                    local(skill) {
                        var eventMap = skill.eventMap;

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
                    method() {
                        console.log(this.subject);
                    },

                    global(skill) {
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

                    local(skill) {
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