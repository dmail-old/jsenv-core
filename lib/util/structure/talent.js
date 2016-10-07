/* eslint-disable no-use-before-define */

/*
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
*/

/*
Conflict resolution

then we'll throw that's how traits.js is doing:  https://howtonode.org/traitsjs
and the recommended way to handle conflict with Talent as state : http://peterseliger.blogspot.fr/2014/04/the-many-talents-of-javascript.html#the-many-talents-of-javascript
because iddylic to consider that conflict may be resolved automagically
and even if they could it's better to see how they are resolved instead of having to learn magic
see also how conflict are resolved here : https://www.npmjs.com/package/simple-traits

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
https://github.com/CocktailJS/cocktail/blob/master/lib/processor/annotation/Traits.js#L86
-> it suggest only method are supported in talent?

The prob is how to resolve conflict due to talent composition ?
resolving conflict due to talent linking is not a prob :

Talent.link(Talent.resolve(talent, {foo: 'remove'}), subject);

But what if

Talent.link(compositeTalent, subject);
where composedTalent would have an internal conflict between foo properties
wehre each foo property would come from compositeTalent.talents[0].instance & compositeTalent.talents[1].instance

(Ce serais bien d'avoir un subject.getTalents() comme unity dispose de subject.getComponents())

*/

import util from './util.js';

const Properties = util.extend({
    constructor() {
        this.map = {};
    },

    populateByFunctionCallReturn(fn, bind, args) {
        const returnValue = fn.apply(bind, args);
        if (returnValue) {
            this.populatebyObject(returnValue);
        }
        return this;
    },

    populatebyObject(object) {
        Object.keys(object).forEach(function(name) {
            this.set(name, Object.getOwnPropertyDescriptor(object, name));
        }, this);
    },

    set(name, attributes) {
        return this.add(Property.create(name, attributes));
    },

    add(property) {
        this.map[property.name] = property;
    },

    [Symbol.iterator]() {
        return Object.keys(this.map).map(function(name) {
            return this.map[name];
        }, this)[Symbol.iterator]();
    },

    has(name) {
        return this.map.hasOwnProperty(name);
    },

    get(name) {
        return this.map.hasOwnProperty(name) ? this.map[name] : null;
    },

    call(name, bind, ...args) {
        return this.get(name).attributes.value.call(bind, ...args);
    },

    merge(properties) {
        Object.assign(this.map, properties.map);
    },

    link(subject) {
        var propertiesLink = [];
        propertiesLink.unlink = function() {
            this.forEach(function(propertyLink) {
                propertyLink.unlink();
            });
        };

        for (let property of this) {
            const propertyLink = this.linkProperty(property, subject);
            if (propertyLink) {
                propertiesLink.push(propertyLink);
            }
        }

        return propertiesLink;
    },

    linkProperty(property, subject) {
        return property.define(subject);
    }
});

const Property = util.extend({
    constructor(name, attributes) {
        this.name = name;
        this.attributes = attributes;
    },

    define(target, name, attributes) {
        const length = arguments.length;
        if (length < 3) {
            attributes = this.attributes;
            if (length < 2) {
                name = this.name;
            }
        }

        if (attributes) {
            Object.defineProperty(target, name, attributes);
        } else {
            delete target[name];
        }
    },

    importDescriptor(object) {
        return this.describe(Object.getOwnPropertyDescriptor(object, this.name));
    },

    describe(attributes) {
        const property = this.createConstructor(this.name, attributes);
        return property;
    },

    delete() {
        const deletedProperty = this.createConstructor(this.name);
        return deletedProperty;
    },

    rename(name) {
        const renamedProperty = this.createConstructor(name, this.attributes);
        return renamedProperty;
    },

    set(value) {
        return this.describe(this.name, Object.assign({}, this.attributes, {value: value}));
    }
});

const StaticProperties = Properties.extend({
    name: 'static'
});
const PrototypeProperties = Properties.extend({
    name: 'prototype'
});
const InstanceProperties = Properties.extend({
    name: 'instance'
});

function installProperties(talent, Properties) {
    let properties;
    const name = Properties.name;
    const value = talent[name];

    if (typeof value === 'function') {
        properties = Properties.create();
        properties.collect = function(bind, ...args) {
            return this.populateByFunctionCallReturn(value, bind, args);
        };
        talent[name] = properties;
    } else if (Properties.isPrototypeOf(value)) {
        properties = value;
    } else {
        throw new TypeError('properties value must be a function or Properties instance');
    }

    return properties;
}

const Talent = util.extend({
    constructor(definition) {
        const scope = Object.create(Talent);
        this.scope = scope;
        if (definition) {
            Object.assign(scope, definition);
        }

        const staticProperties = installProperties(scope, StaticProperties);
        staticProperties.collect(scope, scope);
        staticProperties.link(scope);
        this.static = scope.static;

        const prototypeProperties = installProperties(scope, PrototypeProperties);
        prototypeProperties.collect(scope, scope);
        this.prototype = scope.prototype;

        installProperties(scope, InstanceProperties);
        this.instance = scope.instance;
    },

    static: function() {
        return null;
    },

    prototype() {
        return null;
    },

    instance() {
        return null;
    },

    is(value) {
        return this.isPrototypeOf(value);
    }
});

// link
Talent.define({
    link(subject, ...args) {
        const scope = this.scope;
        const linkedScope = Object.create(scope);
        const prototypeProperties = scope.prototype;
        const instanceProperties = scope.instance;
        const subjectProperties = SubjectProperties.create();

        linkedScope.subject = subject;
        instanceProperties.collect(linkedScope, linkedScope, ...args);

        subjectProperties.merge(prototypeProperties);
        subjectProperties.merge(instanceProperties);

        // using a separated object (subjectPropertiesLink) prevent memory from keeping in memory how to
        // remove a talent properties when nothing keep a reference to it
        const subjectPropertiesLink = subjectProperties.link(subject);
        // subjectPropertiesLink.callProto = function(name, ...args) {
        //     const bind = this === subjectPropertiesLink ? subject : this;
        //     return talent.prototype.get(name).attributes.value.call(bind, ...args);
        // };
        return subjectPropertiesLink;
    }
});

const SubjectProperties = Properties.extend({
    name: 'subject',

    setPrototypeProperties(prototypeProperties) {
        this.merge(prototypeProperties);
    },

    setInstanceProperties(instanceProperties) {
        this.merge(instanceProperties);
    },

    linkProperty(property, subject) {
        let resolvedProperty;
        let currentProperty;

        const propertyName = property.name;
        let propertyOwner;

        if (propertyName in subject) {
            propertyOwner = subject;
            while (propertyOwner.hasOwnProperty(propertyName) === false) {
                propertyOwner = Object.getprototypeOf(propertyOwner);
            }
            currentProperty = property.importDescriptor(propertyOwner);
            resolvedProperty = property.resolutionStrategy.resolve(property, currentProperty);
        } else {
            propertyOwner = subject;
            currentProperty = property.delete();
            resolvedProperty = property;
        }

        resolvedProperty.define(subject);

        const link = {
            oldProperty: currentProperty,
            unlink() {
                this.oldProperty.define(propertyOwner);
            }
        };
        return link;
    }
});

// resolve conflict
Talent.define({
    resolve(resolvers) {
        var hasPrototype = 'prototype' in resolvers;
        var hasInstance = 'instance' in resolvers;
        let resolvedTalent;
        if (hasPrototype || hasInstance) {
            resolvedTalent = Object.create(Talent);
            resolvedTalent.static = this.static;
            resolvedTalent.static.link(resolvedTalent);

            if (hasPrototype) {
                resolvedTalent.prototype = this.prototype.resolve(resolvers.prototype);
            } else {
                resolvedTalent.prototype = this.prototype;
            }
            if (hasInstance) {
                resolvedTalent.instance = this.instance.resolve(resolvers.instance);
            } else {
                resolvedTalent.instance = this.instance;
            }
        } else {
            throw new Error('Talent.resolve must be called with prototype or instance resolvers');
        }
        return resolvedTalent;
    }
});

Properties.define({
    resolve(conflictResolution) {
        const resolvedProperties = this.createConstructor();

        resolvedProperties.collect = this.collect; // share collect() method, that's very important

        for (let property of this) {
            let resolvedProperty = this.resolveProperty(property, conflictResolution);
            resolvedProperties.add(resolvedProperty);
        }

        return resolvedProperties;
    },

    resolveProperty(property, conflictResolution) {
        let resolvedProperty;
        const propertyName = property.name;
        if (conflictResolution.hasOwnProperty(propertyName)) {
            resolvedProperty = property.resolve(conflictResolution[propertyName]);
            if (resolvedProperty.resolutionStrategy.name === 'rename') {
                const renamedWith = resolvedProperty.name;
                if (this.has(renamedWith)) {
                    throw new Error(
                        'cannot resolve by renaming property into ' + renamedWith + ' : this property already exists'
                    );
                }

                resolvedProperty = this.resolveProperty(resolvedProperty, conflictResolution);
            }
        } else {
            resolvedProperty = property;
        }
        return resolvedProperty;
    }
});

StaticProperties.define({
    linkProperty(property, talent) {
        // here we don't care if the object already have a property in its prototype
        // we only care about  talent properties, that's why we use hasOwnProperty and not in
        let resolvedProperty = property;
        resolvedProperty.define(talent);
    }
});

util.define.call(Property, {
    resolve(resolutionValue) {
        let resolvedProperty;
        const resolutionStrategy = Resolution.from(resolutionValue);

        if (resolutionStrategy) {
            resolvedProperty = this.createConstructor(this.name, this.attributes);
            resolvedProperty.resolutionStrategy = resolutionStrategy;
            // property has many method used to create an other property like set/importDescriptor etc
            // resolutionStrategy will be lost if we don't do something to keep it amongst instance
            resolutionStrategy.effect(resolvedProperty);
        } else {
            throw new Error(
                'no resolution strategy registered matched value ' +
                resolutionValue + ' for property' + this.name
            );
        }
        return resolvedProperty;
    }
});

const Resolution = (function() {
    const Resolution = {
        strategies: [],

        from(value) {
            let strategy;
            for (let Strategy of this.strategies) {
                strategy = Strategy.from(value);
                if (strategy) {
                    break;
                }
            }
            return strategy;
        },

        register(strategy) {
            this.strategies.push(strategy);
        }
    };

    const PropertyResolutionStrategy = util.extend({
        from() {},
        effect() {},
        resolve() {}
    });

    const DefaultResolutionStrategy = PropertyResolutionStrategy.extend({
        name: 'default',

        resolve(property) {
            throw new Error('unhandled conflict for property ' + property.name);
        }
    });

    util.define.call(Property, {
        resolutionStrategy: DefaultResolutionStrategy
    });

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

    const AroundResolutionStrategy = PropertyResolutionStrategy.extend({
        from(value) {
            if (typeof value === 'object' && 'around' in value) {
                return this.create(value.around);
            }
        },

        constructor(around) {
            this.around = around;
        },

        resolve(property, conflictualProperty) {
            const around = this.around;
            return this.set(function() {
                return around(
                    property.attributes.value,
                    conflictualProperty.attributes.value,
                    arguments
                );
            });
        }
    });
    Resolution.register(AroundResolutionStrategy);

    const AfterResolutionStrategy = PropertyResolutionStrategy.extend({
        from(value) {
            if (value === 'before') {
                return this.create();
            }
        },

        resolve(property, conflictualProperty) {
            return property.set(composeFunction(
                property.attributes.value,
                conflictualProperty.attributes.value,
                'after'
            ));
        }
    });
    Resolution.register(AfterResolutionStrategy);

    const BeforeResolutionStrategy = PropertyResolutionStrategy.extend({
        from(value) {
            if (value === 'before') {
                return this.create();
            }
        },

        resolve(property, conflictualProperty) {
            return property.set(composeFunction(
                property.attributes.value,
                conflictualProperty.attributes.value,
                'before'
            ));
        }
    });
    Resolution.register(BeforeResolutionStrategy);

    const RemoveResolutionStrategy = PropertyResolutionStrategy.extend({
        name: 'remove',

        from(value) {
            if (value === 'remove') {
                return this.create();
            }
        },

        resolve(property) {
            return property;
        }
    });
    Resolution.register(RemoveResolutionStrategy);

    const ReplaceResolutionStrategy = PropertyResolutionStrategy.extend({
        name: 'replace',
        from(value) {
            if (value === 'replace') {
                return this.create();
            }
        },

        resolve(property, conflictualProperty) {
            return conflictualProperty;
        }
    });
    Resolution.register(ReplaceResolutionStrategy);

    const RenameResolutionStrategy = PropertyResolutionStrategy.extend({
        name: 'rename',
        from(value) {
            if (typeof value === 'object' && 'rename' in value) {
                return this.create(value.rename);
            }
        },

        constructor(renameWith) {
            this.renameWith = renameWith;
        },

        effect(property) {
            property.name = this.renameWith;
        },

        resolve() {
            // this strategy is the only one that does not guarantee the property is not conflictual anymore
            // so if we reach this method it means the property was marked as resolved by being renamed
            // but remains conflictual
            return PropertyResolutionStrategy.resolve.apply(this.arguments);
        }
    });
    Resolution.register(RenameResolutionStrategy);

    return Resolution;
})();

// composition
Talent.define({
    compose(...talents) {
        const compositeTalent = Object.create(Talent);

        const compositeStaticProperties = StaticProperties.create();
        compositeStaticProperties.merge(...talents.map(function(talent) {
            return talent.static;
        }));
        compositeStaticProperties.link(compositeTalent);
        compositeTalent.static = compositeStaticProperties;

        // we will compose all talent.prototype properties and detect conflict
        // si y'a un conlift on cherche à le résoudre avec la stratégie de A
        // sinon avec la stratégie de B
        // si aucun des deux ne résoud on dit que y'a rien pour résoudre
        // parce qu'en fait ce que font les autres c'est tout pourri il résolve les propriétés avant même de savoir si y'a un conflit
        // ou alors c'est ce qu'on devrait faire? bah non sinon on peut pas faire after/before/around/replace
        // quoiqu'on pourrait la propriété serait marqué comme hey je veux m'éxécuter après en cas de conflit
        // donc si on trouve un conflit bim
        // ou alors hey je veux disparaitre en cas de conflit ça c'est good
        // par contre si deux propriété sont marqué comme je veux remplacer on fait quoi?
        // je pense que dans ce cas il faut considérer qu'une seule propriété à le droit de définir
        // une stratégie de résolution de conflit, sinon y'a confiit de résolution

        // linkProperty(property, subject) {
        //     let resolvedProperty;
        //     let currentProperty;

        //     const propertyName = property.name;
        //     let propertyOwner;

        //     if (propertyName in subject) {
        //         propertyOwner = subject;
        //         while (propertyOwner.hasOwnProperty(propertyName) === false) {
        //             propertyOwner = Object.getprototypeOf(propertyOwner);
        //         }
        //         currentProperty = property.importDescriptor(propertyOwner);
        //         resolvedProperty = property.resolutionStrategy.resolve(property, currentProperty);
        //     } else {
        //         propertyOwner = subject;
        //         currentProperty = property.delete();
        //         resolvedProperty = property;
        //     }

        //     resolvedProperty.define(subject);

        //     const link = {
        //         oldProperty: currentProperty,
        //         unlink() {
        //             this.oldProperty.define(propertyOwner);
        //         }
        //     };
        //     return link;
        // }

        const compositePrototypeProperties = PrototypeProperties.create();
        compositePrototypeProperties.compose(...talents.map(function(composedTalent) {
            return composedTalent.prototype;
        }));
        compositeTalent.prototype = compositePrototypeProperties;

        // we create a compositeInstanceProperties but the conflict detection will occur during Talent.link
        const compositeInstanceProperties = InstanceProperties.create();
        compositeInstanceProperties.collect = function(composedTalent, ...args) {
            const composedTalentInstanceProperties = composedTalent.instance.collect(composedTalent, ...args);
            return composedTalentInstanceProperties;
        };
        compositeTalent.instance = compositeInstanceProperties;

        /*
        we'll have to see how conflict are resolved but I think we have nothing to do to adapt compositeTalent
        for resolution
        [resolveTalentSymbol](conflictResolution) {
            // all skills must now use the new resolver
            const resolvedTalentList = Object.create(this);

            resolvedTalentList.talents = this.talents.map(function(talent) {
                return Talent.resolve(talent, conflictResolution);
            });

            return resolvedTalentList;
        }
        */

        return compositeTalent;
    }
});

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('Talent.create', function() {
            this.add('static only', function() {
                const talent = Talent.create({
                    static: function() {
                        var secret = 'foo';

                        // static is cool with property defined in it
                        // you are completely allowed to define any property here, even instance or prototype
                        // however it will takes precedence if you defined the same property to Talent.create()
                        return {
                            foo() {
                                return secret;
                            }
                        };
                    }
                });

                assert(talent.static.get('foo').name === 'foo');
                assert(talent.static.call('foo') === 'foo');
                assert(Talent.is(talent));
                // assert('create' in talent === false);
                // not true anymore, now talent.static is linked only on the talent passed
                // to prototype & instance
            });

            this.add('prototype only', function() {
                const talent = Talent.create({
                    prototype() {
                        var secret = 'bar';

                        return {
                            foo() {
                                return secret;
                            }
                        };
                    }
                });

                assert(talent.prototype.get('foo').attributes.value() === 'bar');
            });

            this.add('prototype defined in static', function() {
                // because they are not defined anymore we loose thie ability
                // one way to correct this would be to check if prototype & instance are defined on static
                // and in that case set it on talent
                const talent = Talent.create({
                    static: function() {
                        return {
                            prototype() {
                                return {
                                    foo() {}
                                };
                            }
                        };
                    }
                });
                assert(talent.prototype.has('foo'));
            });
        });

        this.add('Talent.resolve', function() {
            const talent = Talent.create({
                prototype() {
                    return {
                        bar() {},
                        foo() {},
                        test() {}
                    };
                }
            });

            const resolvedTalent = talent.resolve({
                prototype: {
                    foo: 'replace',
                    test: {
                        rename: 'free'
                    },
                    free: 'remove'
                }
            });

            // ensure that Talent.resolve creates property with a specific resolution strategy
            const barProperty = talent.prototype.get('bar');
            assert(barProperty.resolutionStrategy.name === 'default');
            const fooProperty = resolvedTalent.prototype.get('foo');
            assert(fooProperty.resolutionStrategy.name === 'replace');
            // ensure test was renamed into free, and that it uses reolutionStrategy 'remove' defined above
            const testProperty = resolvedTalent.prototype.get('free');
            assert(testProperty.resolutionStrategy.name === 'remove');
            assert(resolvedTalent.prototype.has('test') === false);

            // if there is an internal renaming collision we throw, (two property cannot have the same name)
            assert.throws(function() {
                talent.resolve({
                    prototype: {
                        foo: {
                            rename: 'bar'
                        }
                    }
                });
            }, function() {
                return true;
            });
        });

        this.add('Talent.link', function() {
            this.add('static only', function() {
                const talent = Talent.create({
                    static: function() {
                        return {
                            foo() {}
                        };
                    }
                });
                const subject = {};
                const link = talent.link(subject);

                assert(link.length === 0);
                assert(Object.keys(subject).length === 0);
            });

            this.add('prototype only', function() {
                const talent = Talent.create({
                    prototype() {
                        return {
                            foo() {
                                return this.name;
                            }
                        };
                    }
                });

                const subject = {name: 'a'};
                const link = talent.link(subject);
                const secondSubject = {name: 'b'};
                talent.link(secondSubject);

                assert(subject.foo() === 'a');
                assert(secondSubject.foo() === 'b');
                assert(subject.foo === secondSubject.foo);

                link.unlink();
                assert(subject.hasOwnProperty('foo') === false);
            });

            this.add('prototype + instance', function() {
                const talent = Talent.create({
                    prototype() {
                        return {
                            foo() {
                                return this.name;
                            }
                        };
                    },

                    instance(scope, name) {
                        return {
                            foo() {
                                return name;
                            },

                            protoFoo() {
                                return scope.prototype.call('foo', this);
                            }
                        };
                    }
                });

                const subject = {
                    name: 'a'
                };
                talent.link(subject, 'b');
                assert(subject.foo() === 'b'); // by default instance properties overrides prototype ones
                assert(subject.protoFoo() === 'a'); // you can still call prototype methods this way
                assert(subject.protoFoo.call({name: 'c'}) === 'c'); // and you can still change this
            });
        });

        /*
        this.add('Talent.compose', function() {
            // compose talent with static only
            // then with prototype only
            // then with instance only
        });

        // now try to link composed talent

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

        this.add('Talent.proxy', function() {
            const Resolvable = Talent.create({
                prototype() {
                    return {
                        before() {
                            this.test = true;
                        }
                    };
                }
            });

            const before = Resolvable.prototype.map.before.attributes.value;

            const ResolvableProxy = Talent.create({
                link(subject, proxy) {
                    proxy.before = function() {
                        return before.apply(subject, arguments);
                    };

                    proxy.before();
                }
            });

            const subject = {};
            const proxy = {};
            Talent.link(ResolvableProxy, subject, proxy);

            // maintenant si je fais proxy.before en fait ça reviens à subject.before sauf que
            // j'ai pas besoin de set before sur subject pour faire ça (hidden talent accessible using proxy)
            // suggested implementation of talent proxy:
            // Talent.proxy = function(talent) {
            //     const proxyTalent = Object.create(talent);
            //     function collectTalentProperties(talent, subject, proxy, ...args) {
            //         return Talent.collectSubjectProperties(talent, subject, ...args).map(function(property) {
            //             let talentMethod = property.attributes.value;
            //             return property.set(function() {
            //                 return talentMethod.apply(subject, arguments);
            //             });
            //         });
            //     };
            //     proxyTalent[linkTalentSymbol] = function(talent, subject, proxy, ...args) {
            //         return collectTalentProperties(talent, subject, proxy, ...args).define(proxy);
            //     };
            //     return proxyTalent;
            // };
        });

        this.add('hidden talent', function() {

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
