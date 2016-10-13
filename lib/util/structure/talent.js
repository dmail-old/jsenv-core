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
    local() {
        var test = '';

        return {
            method() {
                console.log(test);
            }
        };
    },

    prototype(local) {
        // you can create private variables related to how subject & skill behave together
        var test = '';

        // and return a list of properties that will be defined on subject and need access to skill class
        return {
            subjectMethodHavingAccessOnSKill() {
                return skill.method();
            }
        };
    },

    instance(local, prototype) {
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

    clone() {
        const clone = this.createConstructor();
        // don't have to clone property
        // because every action on property does not mutate the property it creates a new one
        // that's one of the strength of being immutable
        Object.assign(clone.map, this.map);
        // also set the populate property (for instanceProperties)
        clone.populate = this.populate;
        return clone;
    },

    populateByFunctionCallReturn(fn, bind, args) {
        const returnValue = fn.apply(bind, args);
        if (returnValue) {
            this.populateByObject(returnValue);
        }
        return this;
    },

    count() {
        return Object.keys(this.map).length;
    },

    populateByObject(object, deep) {
        Object.keys(object).forEach(function(name) {
            this.add(Property.create(name).from(object));
        }, this);

        if (deep) {
            let objectAncestor = Object.getPrototypeOf(object);
            while (objectAncestor) {
                Object.keys(objectAncestor).forEach(function(name) { // eslint-disable-line
                    if (this.has(name) === false) {
                        let property = Property.create(name).from(objectAncestor);
                        this.add(property);
                    }
                }, this);
                objectAncestor = Object.getPrototypeOf(objectAncestor);
            }
        }
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
        return this.get(name).descriptor.value.call(bind, ...args);
    },

    define(subject) {
        for (let property of this) {
            property.define(subject);
        }
    }
});

const Property = util.extend({
    constructor(name) {
        this.name = name;
    },
    name: '',
    descriptor: null,
    owner: null,

    clone() {
        const clone = this.createConstructor(this.name);
        clone.owner = this.owner;
        clone.descriptor = this.descriptor;
        clone.resolutionStrategy = this.resolutionStrategy;
        return clone;
    },

    from(owner) {
        if (Object.prototype.isPrototypeOf(owner) === false) { // object & function allowed
            throw new TypeError('property.from() first argument must inherit from Object.prototype');
        }

        const property = this.clone();
        property.owner = owner;
        property.descriptor = Object.getOwnPropertyDescriptor(owner, this.name);
        return property;
    },

    describe(descriptor) {
        if (typeof descriptor !== 'object' && descriptor !== null) {
            throw new TypeError('property.describe() first arguments must be an object or null');
        }

        const property = this.clone();
        property.descriptor = descriptor;
        return property;
    },

    delete() {
        return this.describe(null);
    },

    rename(name) {
        const renamedProperty = this.clone();
        renamedProperty.name = name;
        return renamedProperty;
    },

    set(value) {
        return this.describe(Object.assign({}, this.descriptor || {}, {value: value}));
    },

    install() {
        const descriptor = this.descriptor;

        if (descriptor) {
            // console.log('define property', this.name, 'on', this.owner);
            Object.defineProperty(this.owner, this.name, descriptor);
        } else {
            delete this.owner[this.name];
        }

        return this;
    },

    assign(owner) {
        let assignedProperty = this.clone();
        assignedProperty.owner = owner;
        return assignedProperty;
    },

    define(owner) {
        return this.assign(owner).install();
    }
});

const LocalProperties = Properties.extend({
    name: 'local'
});
const PrototypeProperties = Properties.extend({
    name: 'prototype'
});
const InstanceProperties = Properties.extend({
    name: 'instance'
});

function installProperties(value, Properties) {
    let properties;

    if (typeof value === 'function') {
        properties = Properties.create();
        properties.populate = function(bind, ...args) {
            this.populateByFunctionCallReturn(value, bind, args);
        };
    } else if (Properties.isPrototypeOf(value)) {
        properties = value;
    } else if (typeof value === 'object') {
        properties = Properties.create();
        properties.populate = function() {
            this.populateByObject(value);
        };
    } else {
        throw new TypeError('properties value must be a function, an object or Properties instance');
    }

    return properties;
}

const Talent = util.extend({
    constructor(definition) {
        if (definition) {
            Object.assign(this, definition);
            this.definition = definition;
        }

        this.localProperties = installProperties(this.local, LocalProperties);
        this.localProperties.populate(this);
        const prototypeLocalProperty = this.localProperties.get('prototype');
        if (prototypeLocalProperty) {
            prototypeLocalProperty.define(this);
        }
        const instanceLocalProperty = this.localProperties.get('instance');
        if (instanceLocalProperty) {
            instanceLocalProperty.define(this);
        }
        this.local = this.createPropertiesTarget(this.localProperties);

        this.prototypeProperties = installProperties(this.prototype, PrototypeProperties);
        this.prototypeProperties.populate(this, this.local);
        this.prototype = this.createPropertiesTarget(this.prototypeProperties);

        this.instanceProperties = installProperties(this.instance, InstanceProperties);
    },
    definition: {},

    createPropertiesTarget(properties) {
        const target = {};
        properties.define(target);
        // this object is public but immutable talent.local & talent.prototype must not be modified
        // once talent has been instantiated
        Object.freeze(target);
        return target;
    },

    local() {},
    prototype() {},
    instance() {},

    is(value) {
        return this.isPrototypeOf(value);
    }
});

// link
Talent.refine({
    link(subject, ...args) {
        const subjectProperties = this.collectSubjectProperties(subject);
        const delegatedProperties = this.collectDelegatedProperties(subject, ...args);
        const propertiesDiff = subjectProperties.combine(delegatedProperties);

        const link = {
            unlink() {
                propertiesDiff.define(subject);
            }
        };

        // using a separated object (subjectPropertiesLink) prevent memory from keeping in memory how to
        // remove a talent properties when nothing keep a reference to it
        subjectProperties.define(subject);

        return link;
    },

    collectSubjectProperties(subject) {
        const subjectProperties = SubjectProperties.create();
        // pass true to collect prototype properties as well
        // because we want to detect if the talent overrides a prototype property too
        subjectProperties.populateByObject(subject, true);
        return subjectProperties;
    },

    collectDelegatedProperties(subject, ...args) {
        const delegatedProperties = Properties.create();
        const instanceProperties = this.collectInstanceProperties(subject, ...args);

        delegatedProperties.merge(this.prototypeProperties);
        delegatedProperties.merge(instanceProperties);

        return delegatedProperties;
    },

    collectInstanceProperties(subject, ...args) {
        const instanceProperties = this.instanceProperties.clone();
        instanceProperties.populate(this, Object.create(this.local), this.prototype, subject, ...args);
        return instanceProperties;
    }
});

const SubjectProperties = Properties.extend({
    name: 'subject'
});

// conflict
Talent.refine({
    resolve(resolvers) {
        if (typeof resolvers !== 'object') {
            throw new TypeError('Talent.resolve() first argument must be an object');
        }

        var hasPrototype = 'prototype' in resolvers;
        var hasInstance = 'instance' in resolvers;
        let resolvedTalent;
        if (hasPrototype || hasInstance) {
            resolvedTalent = Object.create(Talent);
            resolvedTalent.localProperties = this.localProperties; // we should clone this
            resolvedTalent.local = this.local; // we should clone this
            resolvedTalent.prototype = this.prototype; // we should clone this

            if (hasPrototype) {
                // if a prototoype properties is resolved and use rename
                // then resolvedTalent.prototype will use not the right property name
                // so we have to recreate a .prototype
                /*
                it makes me realize something :
                because the property will be resolved when combined and you don't know subject yet
                prototype may have to be created when subject is known because at this specific moment
                we know the value for a property saying it wants to be executed after or before
                so creating prototype earlier cannot work
                */
                resolvedTalent.prototypeProperties = this.prototypeProperties.resolve(resolvers.prototype);
            } else {
                // here I'm not sure we have to clone because we are not suppose to mutate
                // prototypeProperties by somehting else than resolve()
                resolvedTalent.prototypeProperties = this.prototypeProperties; // we should clone this
            }
            if (hasInstance) {
                resolvedTalent.instanceProperties = this.instanceProperties.resolve(resolvers.instance);
            } else {
                resolvedTalent.instanceProperties = this.instanceProperties; // we should clone this
            }
        } else {
            throw new Error('Talent.resolve first arguments must have prototype or instance property');
        }
        return resolvedTalent;
    }
});

Properties.refine({
    resolve(conflictResolution) {
        const resolvedProperties = this.createConstructor();

        resolvedProperties.populate = this.populate; // share populate() method, that's very important

        for (let property of this) {
            let resolvedProperty = this.resolveProperty(property, conflictResolution);
            resolvedProperties.add(resolvedProperty);
        }

        return resolvedProperties;
    },

    // if (resolutionStrategy.immediate) {

    //         selfStrategyName === 'rename' &&
    //         otherStrategyName === 'rename' &&
    //         selfStrategy.renameWith === otherStrategy.renameWith
    //     ) {
    //         throw new Error('conflict between rename resolution strategy for property named "' + this.name + '"');
    //     } else
    //         }

    resolveProperty(property, conflictResolution) {
        let resolvedProperty;
        const propertyName = property.name;
        if (conflictResolution.hasOwnProperty(propertyName)) {
            // console.log('resolve property with', conflictResolution[propertyName], 'from object', conflictResolution);
            resolvedProperty = property.resolve(conflictResolution[propertyName]);
            const resolutionStrategy = resolvedProperty.resolutionStrategy;
            if (resolutionStrategy.resolveInternal) {
                resolvedProperty = resolutionStrategy.resolveInternal(resolvedProperty, this, conflictResolution);
                // resolvedProperty = this.resolveProperty(resolvedProperty, conflictResolution);
            }
        } else {
            resolvedProperty = property;
        }
        return resolvedProperty;
    }
});

Property.refine({
    createConflictError(conflictualProperty, message, howToFix) {
        const error = new Error(message);
        error.name = 'PropertyError';
        error.meta = {
            property: this,
            conflictualProperty: conflictualProperty,
            howToFix: howToFix
        };
        return error;
    },

    resolve(resolutionValue) {
        let resolvedProperty;
        const resolutionStrategy = Resolution.from(resolutionValue);

        if (resolutionStrategy) {
            resolvedProperty = this.clone();
            resolvedProperty.resolutionStrategy = resolutionStrategy;
        } else {
            throw new Error(
                'no resolution strategy registered matched ' +
                resolutionValue + ' for property named "' + this.name + '"'
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

    const InheritResolutionStrategy = PropertyResolutionStrategy.extend({
        name: 'inherit',

        from(value) {
            if (value === 'inherit') {
                return this;
            }
        },

        resolve(property, conflictualProperty) {
            throw property.createConflictError(
                conflictualProperty,
                'conflict must be handled for property named "' + property.name + '"',
                'resolve(\'remove\')'
            );
        }
    });

    Property.refine({
        resolutionStrategy: InheritResolutionStrategy
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
        if (typeof when === 'function') {
            return function() {
                return when.call(this, composedFn, fn, arguments, this);
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
            return property.set(composeFunction(
                conflictualProperty.descriptor.value,
                property.descriptor.value,
                around
            ));
        }
    });
    Resolution.register(AroundResolutionStrategy);

    const AfterResolutionStrategy = PropertyResolutionStrategy.extend({
        from(value) {
            if (value === 'after') {
                return this;
            }
        },

        resolve(property, conflictualProperty) {
            return property.set(composeFunction(
                conflictualProperty.descriptor.value,
                property.descriptor.value,
                'after'
            ));
        }
    });
    Resolution.register(AfterResolutionStrategy);

    const BeforeResolutionStrategy = PropertyResolutionStrategy.extend({
        from(value) {
            if (value === 'before') {
                return this;
            }
        },

        resolve(property, conflictualProperty) {
            return property.set(composeFunction(
                conflictualProperty.descriptor.value,
                property.descriptor.value,
                'before'
            ));
        }
    });
    Resolution.register(BeforeResolutionStrategy);

    const RemoveResolutionStrategy = PropertyResolutionStrategy.extend({
        name: 'remove',

        from(value) {
            if (value === 'remove') {
                return this;
            }
        },

        resolve(property, conflictualProperty) {
            if (conflictualProperty.resolutionStrategy.name === 'remove') {
                // do we remove both property ?
                // do we throw we cannot remove both ?
                // removing both is not supported because it would delete the property
                // but I got the feeling remove should take effect immedatly and result
                // into removing the property from properties
                return conflictualProperty.delete();
            }
            return conflictualProperty;
        }
    });
    Resolution.register(RemoveResolutionStrategy);

    const ReplaceResolutionStrategy = PropertyResolutionStrategy.extend({
        name: 'replace',
        from(value) {
            if (value === 'replace') {
                return this;
            }
        },

        resolve(property) {
            return property;
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

        resolveInternal(property, properties, resolution) {
            let resolvedProperty;
            const renameWith = this.renameWith;

            // property.name = renameWith;
            // check if rename creates an internal conflict
            const conflictualProperty = properties.get(renameWith);

            if (conflictualProperty) {
                var message = 'conflict must not be handled by renaming "' + property.name + '" -> "' + renameWith;
                message += '" because it already exists';
                let error = property.createConflictError(
                    conflictualProperty,
                    message,
                    'resolve({rename: \'' + renameWith + '-free\'})'
                );
                throw error;
            } else {
                property.name = renameWith; // rename right now
                resolvedProperty = properties.resolveProperty(property, resolution); // and resolve the renamed property
            }

            return resolvedProperty;
            // this strategy is the only one that does not guarantee the property is not conflictual anymore
            // and the final resolvedProperty cannot use the rename strategy because the rename strategy takes effect
            // immediatly
        }
    });
    Resolution.register(RenameResolutionStrategy);

    return Resolution;
})();

// composition
Talent.refine({
    compose(...talents) {
        const compositeTalent = Object.create(Talent);

        // we don't have to compose local because composeTalent local properties are allowed to conflict
        // (unlike prototype & instance)
        // so there is no pertinent modelisation of compositeLocalProperties
        // const compositeLocalProperties = LocalProperties.create();
        // compositeLocalProperties.merge(...talents.map(function(talent) {
        //     return talent.local;
        // }));
        // compositeLocalProperties.object = {};
        // compositeLocalProperties.link(compositeLocalProperties.object);
        compositeTalent.local = this.local;

        // we create composite properties right away, and concerning prototype properties
        // we can even enable conflict detection right away
        const prototypePropertiesComposants = talents.map(function(composedTalent) {
            return composedTalent.prototypeProperties;
        });

        try {
            const compositePrototypeProperties = this.prototypeProperties.compose(...prototypePropertiesComposants);
            compositeTalent.prototypeProperties = compositePrototypeProperties;
        } catch (e) {
            if (e.name === 'PropertyError') {
                var property = e.meta.property;
                var conflictualProperty = e.meta.conflictualProperty;
                var name = property.name;
                var allTalents = [this, ...talents];
                var firstTalentUsingProperty = allTalents.find(function(talent) {
                    return talent.prototypeProperties.get(name) === conflictualProperty;
                });
                var firstIndex = allTalents.indexOf(firstTalentUsingProperty);
                var nextTalents = allTalents.slice(firstIndex - 1);
                var secondTalentUsingProperty = nextTalents.find(function(talent) {
                    return talent.prototypeProperties.get(name) === property;
                });
                var secondIndex = allTalents.indexOf(secondTalentUsingProperty);

                var message = '';
                var firstTalentName;
                if (firstIndex === 0) {
                    firstTalentName = 'talent';
                } else if (firstIndex === 1) {
                    firstTalentName = '1st talent in arguments';
                } else if (firstIndex === 2) {
                    firstTalentName = '2nd talent in arguments';
                } else {
                    firstTalentName = 'talent n°' + (firstIndex - 1) + ' in arguments';
                }
                var secondTalentName;
                if (secondIndex === 1) {
                    secondTalentName = '1st talent in arguments';
                } else if (secondIndex === 2) {
                    secondTalentName = '2nd talent in arguments';
                } else {
                    secondTalentName = 'talent n°' + (secondIndex - 1) + ' in arguments';
                }
                message += firstTalentName + ' & ' + secondTalentName + ' are in conflict';

                var talentCompositionError = new Error(message);
                var detail = '';

                detail += e.message;
                detail += '\n\nhint : You can resolve conflict using';
                var howToFix = e.meta.howToFix;
                howToFix = howToFix.slice('resolve('.length, -1);
                detail += '\n\ttalent.resolve({prototype: {' + name + ': ' + howToFix + '}})';

                talentCompositionError.detail = detail;
                talentCompositionError.hideFirst = true;
                throw talentCompositionError;
            }
            throw e;
        }

        // this is not mandatory but it allows to have an object version of the compositeTalent prototype properties
        // even if, it's not used by the internal API for now
        // const compositePrototype = {};
        // compositeTalent.prototype = compositePrototype;
        // compositePrototypeProperties.link(compositePrototype);

        // we create a compositeInstanceProperties but the conflict detection is deffered to Talent.link
        // so inside populate (when we know the subject)
        const compositeInstanceProperties = this.instanceProperties.clone();
        const old = this;
        compositeInstanceProperties.populate = function(compositeTalent, local, prototype, subject, ...args) {
            this.combine(old.collectInstanceProperties(subject, ...args));
            this.combine(...talents.map(function(composedTalent) {
                return composedTalent.collectInstanceProperties(subject, ...args);
            }));
        };
        compositeTalent.instanceProperties = compositeInstanceProperties;

        return compositeTalent;
    }
});

Properties.refine({
    compose(...propertiesList) {
        const compositeProperties = this.createConstructor();
        compositeProperties.merge(this);
        propertiesList.forEach(function(properties) {
            compositeProperties.combine(properties);
        });
        return compositeProperties;
    },

    merge(properties) {
        Object.assign(this.map, properties.map);
    },

    combine(properties) {
        const propertiesDiff = Properties.create();

        for (let property of properties) {
            const propertyName = property.name;
            const currentProperty = this.get(propertyName);

            if (currentProperty) {
                // detect if both resolutionStrategy are conflictual
                const resolvedProperty = property.resolveConflict(currentProperty);
                // console.log('compose resolvedporperty', resolvedProperty);
                propertiesDiff.add(currentProperty);
                this.add(resolvedProperty);
            } else {
                // console.log('compose non conflictualProperty', property);
                propertiesDiff.add(property.delete());
                this.add(property);
            }
        }

        return propertiesDiff;
    }
});

Property.refine({
    resolveConflict(conflictualProperty) {
        const selfStrategy = this.resolutionStrategy;
        const otherStrategy = conflictualProperty.resolutionStrategy;
        const selfStrategyName = selfStrategy.name;
        const otherStrategyName = otherStrategy.name;
        let propertyResponsibleToResolve;

        if (selfStrategyName === 'inherit') {
            propertyResponsibleToResolve = conflictualProperty;
        } else if (otherStrategyName === 'inherit') {
            propertyResponsibleToResolve = this;
        } else if (conflictualProperty.hasOwnProperty('resolutionStrategy')) {
            propertyResponsibleToResolve = conflictualProperty;
        } else if (this.hasOwnProperty('resolutionStrategy')) {
            propertyResponsibleToResolve = this;
        } else {
            propertyResponsibleToResolve = conflictualProperty;
        }

        let propertyToResolve;
        if (propertyResponsibleToResolve === this) {
            propertyToResolve = conflictualProperty;
        } else {
            propertyToResolve = this;
        }

        const resolvedProperty = propertyResponsibleToResolve.resolutionStrategy.resolve(
            propertyResponsibleToResolve,
            propertyToResolve
        );

        return resolvedProperty;
    }
});

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        function spy(fn) {
            function spyFn() {
                const lastCall = {};
                spyFn.lastCall = lastCall;
                lastCall.this = this;
                lastCall.args = arguments;

                if (fn) {
                    lastCall.return = fn.apply(this, arguments);
                    return lastCall.return;
                }
            }
            return spyFn;
        }

        function assertMethods(a, b) {
            Object.keys(a).filter(function(name) {
                return typeof a[name] === 'function';
            }).forEach(function(name) {
                assert(a[name] === b[name], 'method differs on property ' + name);
            });
        }

        this.add('Talent.create', function() {
            this.add('local only', function() {
                const talent = Talent.create({
                    local() {
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

                assert(talent.local.foo() === 'foo');
                assert(Talent.is(talent));
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

                assert(talent.prototype.foo() === 'bar');
            });

            this.add('prototype defined in local', function() {
                const talent = Talent.create({
                    local() {
                        return {
                            prototype() {
                                return {
                                    foo() {}
                                };
                            }
                        };
                    }
                });
                assert('foo' in talent.prototype);
            });
        });

        this.add('Talent.link', function() {
            this.add('local + prototype + instance', function() {
                const talent = Talent.create({
                    local() {
                        return {
                            helper() {
                                return 'hello';
                            }
                        };
                    },

                    prototype() {
                        return {
                            foo() {
                                return this.name;
                            },

                            test() {}
                        };
                    },

                    instance(local, prototype, subject, name) {
                        return {
                            foo() {
                                return name;
                            },

                            [name]() {

                            },

                            protoFoo() {
                                return prototype.foo.call(this);
                            },

                            bar() {
                                return local.helper();
                            }
                        };
                    }
                });

                const subject = {
                    name: 'a'
                };
                const secondSubject = {
                    name: 'b'
                };
                const link = talent.link(subject, 'dam');
                talent.link(secondSubject);

                assert(subject.foo() === 'dam'); // foo overided by instance property
                assert(secondSubject.foo() === undefined);
                assert(subject.protoFoo() === 'a'); // you can still call prototype methods this way
                assert(secondSubject.protoFoo() === 'b');
                assert(subject.protoFoo.call({name: 'c'}) === 'c'); // and you can still change this
                assert(subject.test === secondSubject.test); // prototype property are shared
                assert(subject.foo !== secondSubject.foo); // instance property are not shared
                assert(typeof subject.dam === 'function');
                assert(secondSubject.hasOwnProperty('dam') === false); // ensure instance properties are unique per link

                link.unlink();
                assert(Object.keys(subject).length === 1);
            });
        });

        this.add('Talent.resolve', function() {
            this.add('basic resolve', function() {
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
                const barProperty = talent.prototypeProperties.get('bar');
                assert(barProperty.resolutionStrategy.name === 'inherit');
                const fooProperty = resolvedTalent.prototypeProperties.get('foo');
                assert(fooProperty.resolutionStrategy.name === 'replace');
                // ensure test was renamed into free, and that it uses reolutionStrategy 'remove' defined above
                const testProperty = resolvedTalent.prototypeProperties.get('free');
                assert(testProperty.resolutionStrategy.name === 'remove');
                assert(resolvedTalent.prototypeProperties.has('test') === false);

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

            this.add('resolve + link on prototype conflict', function() {
                let afterExecution = [];
                let beforeExecution = [];
                let aroundExecution = [];
                const protoModel = {
                    willBeRenamed() {},
                    willBeRemoved() {},
                    willBeReplaced() {},
                    willBeExecutedAfter() {
                        afterExecution.push('prototype');
                    },
                    willBeExecutedBefore() {
                        beforeExecution.push('prototype');
                    },
                    willBeExecutedAround() {
                        aroundExecution.push('prototype');
                    }
                };
                const talent = Talent.create({
                    prototype() {
                        return protoModel;
                    }
                });
                let aroundArgs;
                const resolvedTalent = talent.resolve({
                    prototype: {
                        willBeRenamed: {rename: 'newName'},
                        willBeRemoved: 'remove',
                        willBeReplaced: 'replace',
                        willBeExecutedAfter: 'after',
                        willBeExecutedBefore: 'before',
                        willBeExecutedAround: {
                            around(previous, current, args) {
                                previous();
                                aroundExecution.push('resolver');
                                aroundArgs = args;
                                current();
                            }
                        }
                    }
                });
                const subjectModel = {
                    willBeRenamed() {},
                    willBeRemoved() {},
                    willBeReplaced() {},
                    willBeExecutedAfter() {
                        afterExecution.push('subject');
                    },
                    willBeExecutedBefore() {
                        beforeExecution.push('subject');
                    },
                    willBeExecutedAround() {
                        aroundExecution.push('subject');
                    }
                };
                const subject = Object.assign({}, subjectModel);

                resolvedTalent.link(subject, 'foo');

                assert(subject.willBeRenamed === subjectModel.willBeRenamed);
                assert(subject.newName === protoModel.willBeRenamed);
                assert(subject.willBeRemoved === subjectModel.willBeRemoved);
                assert(subject.willBeReplaced === protoModel.willBeReplaced);
                subject.willBeExecutedAfter();
                assert(afterExecution.join() === 'subject,prototype');
                subject.willBeExecutedBefore();
                assert(beforeExecution.join() === 'prototype,subject');
                subject.willBeExecutedAround('test');
                assert(aroundExecution.join() === 'subject,resolver,prototype');
                assert(aroundArgs[0] === 'test');
            });
        });

        this.add('Talent.compose', function() {
            this.add('local + prototype + instance', function() {
                const firstTalent = Talent.create({
                    local: spy(function() {
                        return {
                            foo() {}
                        };
                    }),

                    prototype: spy(function(local) {
                        return {
                            firstLocal() {
                                return local;
                            }
                        };
                    }),

                    instance: spy(function(local, prototype, subject) {
                        local.instancied = true;

                        return {
                            firstInstance() {
                                return subject;
                            }
                        };
                    })
                });
                const secondTalent = Talent.create({
                    local: spy(function() {
                        return {
                            foo() {},
                            bar() {}
                        };
                    }),

                    prototype: spy(function(local) {
                        return {
                            secondLocal() {
                                return local;
                            }
                        };
                    }),

                    instance: spy(function(local, prototype, subject) {
                        return {
                            secondInstance() {
                                return subject;
                            }
                        };
                    })
                });
                const compositeTalent = firstTalent.compose(secondTalent);

                [firstTalent, secondTalent].forEach(function(talent) {
                    // assert local is called with right this/arguments
                    const localCall = talent.definition.local.lastCall;
                    assert(localCall.this === talent);
                    assert(localCall.args.length === 0);
                    // assert prototype is called with right this/arguments
                    const prototypeCall = talent.definition.prototype.lastCall;
                    assert(prototypeCall.this === talent);
                    assert(prototypeCall.args.length === 1);
                    const prototypeLocal = prototypeCall.args[0];
                    assertMethods(prototypeLocal, localCall.return);
                });

                const subject = {};
                const link = compositeTalent.link(subject, 'foo');
                [firstTalent, secondTalent].forEach(function(talent) {
                    // assert instance is called with right this/arguments
                    const prototypeLocal = talent.definition.prototype.lastCall.args[0];
                    const instanceCall = talent.definition.instance.lastCall;
                    assert(instanceCall.this === talent);
                    const instanceArgs = instanceCall.args;
                    const instanceLocal = instanceArgs[0];
                    // assert instanceLocal && prototypeLocal are !== because instance is allowed to modify
                    // local if he needs to but also needs an access to local methods
                    assert(instanceLocal !== prototypeLocal);
                    assertMethods(instanceLocal, prototypeLocal);
                    const instancePrototype = instanceArgs[1];
                    const prototypeMethods = talent.prototype;
                    assertMethods(instancePrototype, prototypeMethods);
                    const instanceSubject = instanceArgs[2];
                    assert(instanceSubject === subject);
                    const instanceThirdArg = instanceArgs[3];
                    assert(instanceThirdArg === 'foo');
                    assert(instanceArgs.length === 4);

                    // assert the correct methods are set on subject
                    assertMethods(prototypeMethods, subject);
                    const instanceMethods = talent.definition.instance.lastCall.return;
                    assertMethods(instanceMethods, subject);
                });

                // assert they can be removed
                link.unlink();
                assert(Object.keys(subject).length === 0);
            });

            this.add('conflict on prototype', function() {
                const first = Talent.create({
                    prototype() {
                        return {
                            foo() {
                                console.log('first');
                            }
                        };
                    }
                });
                const second = Talent.create({
                    prototype() {
                        return {
                            foo() {
                                console.log('second');
                            }
                        };
                    }
                });

                first.compose(second);
            });

            // assert error occurs when two composed talent use same name for prototype
            // assert the above conflict can be resolved
            // assert the same for instance (occurs on talent.link)
            // assert error occurs when two composed talent use two resolved conflictual property
            // assert error occurs when composite talent has conflictual property with subject
        });

        // maybe add TalentError : any error related to a talent
        // TalentDelegationError : any error related to Talent.link()
        // TalentCompositionError : any error related to Talent.compose()

        // we are loosing the ability to refine stuff like we could when using proto.js
        // here talent are so descriptive that I did not plan any API, strategy for having a progressive talent
        // definition just like proto may be progressively defined as we go
        /*
        something like
        const talent = Talent.create();
        talent.refine({}); // possible
        talent.refineProto({}); // possible
        // but as we can see in the article on many talent of JavaScript we got some private scope etc
        // so the api must be inside the prototype() function, like

        const talent = Talent.create({
            prototype(local) {
                // we can add method using this.prototype
                // the signature with return is just an other way to add property
                // a way that does not force user to know the API
                this.prototype.refine({
                    method() {}
                });
            }
        });
        */

        /*
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
            en fait trop simple, un proxy sers juste à récup les méthodes pour les apeller sans les installer sur subject
            donc en gros juste à faire talent.collectSubjectProperties()
            puis subjectProperties.call('method', subject);
            par contre jre vois un problème: dans le cas ou les propriétés contiennent un state
            par example pour observable bah observable n'étant pas installé sur subject, ça ne marcheras pas
            il faudrait empâcher les propriétés de contenir autre chose que des fonctions
            mais les component plus tard auront le droit d'en installer une : celle qui leur correspond
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
