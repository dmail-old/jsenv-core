/* eslint-disable no-use-before-define */

// const CompositeMethod = util.extend({
//     install() {
//     },
//     resolve() {
//     }
// });

// can we just add an infected compose() which is aware of conflict and tries to handle them ?
// anyway we need to handle conflict between constructor() method which must by default register every method
// and later set a specific constructor method that will execute sequentially every constructor and return first non null returned value
// or the object on which unit is produced (can be a custom object if you do unit.produceOn() instead of produce())

import util from './util.js';
import {Property, Properties, Unit} from './composable.js';

Properties.refine({
    // redefine merge to handle merge conflict
    merge(properties) {
        for (let property of properties) {
            const propertyName = property.name;
            const currentProperty = this.get(propertyName);

            if (currentProperty) {
                const resolvedProperty = property.resolveConflict(currentProperty);
                if (resolvedProperty !== currentProperty) {
                    this.add(resolvedProperty);
                }
            } else {
                this.add(property);
            }
        }
        return this;
    }
});

Properties.refine({
    resolve(mergeConflictResolverDescription) {
        const resolvedProperties = this.createConstructor();

        Object.assign(resolvedProperties.map, this.map);
        resolvedProperties.populate = this.populate; // share populate() method, that's very important

        for (let property of this) {
            let resolvedProperty = this.resolveProperty(property, mergeConflictResolverDescription);
            resolvedProperties.replace(property, resolvedProperty);
        }

        return resolvedProperties;
    },

    replace(property, otherProperty) {
        const map = this.map;
        const propertyName = property.name;
        const otherPropertyName = otherProperty.name;
        if (propertyName === otherPropertyName) {
            if (otherProperty.descriptor === null) {
                delete map[propertyName];
            } else {
                map[propertyName] = otherProperty;
            }
        } else {
            delete map[propertyName];
            if (otherProperty.descriptor) {
                map[otherPropertyName] = otherProperty;
            }
        }
    },

    // if (resolutionStrategy.immediate) {

    //         selfStrategyName === 'rename' &&
    //         otherStrategyName === 'rename' &&
    //         selfStrategy.renameWith === otherStrategy.renameWith
    //     ) {
    //         throw new Error('conflict between rename resolution strategy for property named "' + this.name + '"');
    //     } else
    //         }

    resolveProperty(property, mergeConflictResolverDescription) {
        let resolvedProperty;
        const propertyName = property.name;
        if (mergeConflictResolverDescription.hasOwnProperty(propertyName)) {
            // console.log('resolve property with', conflictResolution[propertyName], 'from object', conflictResolution);
            const resolver = Resolver.from(mergeConflictResolverDescription[propertyName]);
            if (!resolver) {
                throw new Error(
                    'no resolver registered matched ' +
                    mergeConflictResolverDescription[propertyName] + ' for property named "' + propertyName + '"'
                );
            }

            resolvedProperty = resolver.resolveNow(property, this, mergeConflictResolverDescription);
        } else {
            resolvedProperty = property;
        }
        return resolvedProperty;
    }
});

const Resolver = (function() {
    const Resolver = {
        resolvers: [],

        from(value) {
            let resolver;
            for (let Resolver of this.resolvers) {
                resolver = Resolver.from(value);
                if (resolver) {
                    break;
                }
            }
            return resolver;
        },

        register(name, methods) {
            const resolver = PropertyResolver.extend({
                name: name
            }, methods);
            this.resolvers.push(resolver);
            return resolver;
        }
    };

    const PropertyResolver = util.extend({
        from(value) {
            const name = this.name;
            if (typeof value === 'string') {
                if (value === name) {
                    return this.create();
                }
            } else if (typeof value === 'object') {
                if (name in value) {
                    return this.create(value[name]);
                }
            }
        },
        name: '',

        resolveNow(property) {
            let resolvedProperty = property.clone();
            resolvedProperty.resolver = this;
            return resolvedProperty;
        },

        resolveLater(property, conflictualProperty) {
            throw property.createConflictError(
                conflictualProperty,
                'conflict must be handled for property named "' + property.name + '"',
                'resolve(\'remove\')'
            );
        }
    });

    return Resolver;
})();

Property.refine({
    resolveConflict(conflictualProperty) {
        const selfResolver = this.resolver;
        const otherResolver = conflictualProperty.resolver;
        const selfResolverName = selfResolver.name;
        const otherResolverName = otherResolver.name;
        let propertyResponsibleToResolve;

        if (selfResolverName === 'inherit') {
            propertyResponsibleToResolve = conflictualProperty;
        } else if (otherResolverName === 'inherit') {
            propertyResponsibleToResolve = this;
        } else if (conflictualProperty.hasOwnProperty('resolver')) {
            propertyResponsibleToResolve = conflictualProperty;
        } else if (this.hasOwnProperty('resolver')) {
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

        const resolvedProperty = propertyResponsibleToResolve.resolver.resolveLater(
            propertyResponsibleToResolve,
            propertyToResolve
        );

        return resolvedProperty;
    },

    createConflictError(conflictualProperty, message, howToFix) {
        const error = new Error(message);
        error.name = 'PropertyError';
        error.meta = {
            property: this,
            conflictualProperty: conflictualProperty,
            howToFix: howToFix
        };
        return error;
    }
});

Unit.refine({
    resolve(mergeConflictResolverDescription) {
        if (typeof mergeConflictResolverDescription !== 'object') {
            throw new TypeError('Unit.resolve() first argument must be an object');
        }
        const resolvedUnit = this.compose();
        resolvedUnit.properties = this.properties.resolve(mergeConflictResolverDescription);
        return resolvedUnit;
    }
});

const ResolverPropertyMatcher = util.extend();

ResolverPropertyMatcher.register('any', {
    match() {
        return true;
    }
});

ResolverPropertyMatcher.register('function', {
    match(property) {
        const descriptor = property.descriptor;
        if ('value' in descriptor) {
            const value = descriptor.value;
            if (typeof value === 'function') {
                return true;
            }
            return 'property value must be a function';
        }
        return true;
    }
});

const InitialResolver = Resolver.register('initial', {
    propertyMatcher: 'any',
    resolveNow(property) {
        let resolvedProperty = property.clone();
        delete resolvedProperty.resolver;
        return resolvedProperty;
    }
});
Property.refine({
    resolver: InitialResolver
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

Resolver.register('around', {
    propertyMatcher: 'function',
    constructor(around) {
        this.around = around;
    },
    resolveLater(property, conflictualProperty) {
        const around = this.around;
        return property.set(composeFunction(
            conflictualProperty.descriptor.value,
            property.descriptor.value,
            around
        ));
    }
});

Resolver.register('after', {
    propertyMatcher: 'function',
    resolveLater(property, conflictualProperty) {
        return property.set(composeFunction(
            conflictualProperty.descriptor.value,
            property.descriptor.value,
            'after'
        ));
    }
});

Resolver.register('before', {
    propertyMatcher: 'function',
    resolveLater(property, conflictualProperty) {
        return property.set(composeFunction(
            conflictualProperty.descriptor.value,
            property.descriptor.value,
            'before'
        ));
    }
});

Resolver.register('remove', {
    propertyMatcher: 'any',
    resolveNow(property) {
        return property.delete();
    }
});

Resolver.register('ignore', {
    propertyMatcher: 'any',
    resolveLater(property, conflictualProperty) {
        return conflictualProperty;
    }
});

Resolver.register('replace', {
    propertyMatcher: 'any',
    resolveLater(property, conflictualProperty) {
        if (conflictualProperty.resolver.name === 'replace') {
            throw new Error('cannot replace both, only one must remain');
        }
        // console.log(
        //     'resolving by replace to',
        //     property.descriptor.value.toString(),
        //     'conflictual is',
        //     conflictualProperty.descriptor.value.toString()
        // );
        return property;
    }
});

Resolver.register('rename', {
    propertyMatcher: 'any',
    constructor(renameWith) {
        this.renameWith = renameWith;
    },
    resolveNow(property, properties, conflictResolverMap) {
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
            const renamedProperty = property.rename(renameWith);
            resolvedProperty = properties.resolveProperty(renamedProperty, conflictResolverMap);
        }

        return resolvedProperty;
    }
});

// to be done, how do we merge value, especially when they are deep ?
// do we have to clone the value when we do mergedDescriptor.value = conflictualDescriptor.value ? is stampit cloning ?
// https://github.com/stampit-org/stampit/blob/master/src/merge.js
// is merge deep by default, do we want a non deep merge (what does a non deep merge means? why would we wnat it)
// until we know merge will be deep by default as stampit provides
// in a previous implement I did merge was cloning sub objects : https://github.com/dmail-old/object-merge/blob/master/index.js
// But I know that cloning object involves way more than this it's the purpose of lab.js, can we accept that merge does not clone but assign subobjects ?
// we don't support circular references that's a prob too no?
// I think we should both support circular reference and object cloning else merge would be problematic because instance could
// mutate model later
// for now let's stick to stampit impl because it's too much work and merge is not the primary goal
// but it will become more important and we'll have to support better merge implementation
// I'm not sure however that we'll be able to correctly clone without lab.js
// else we could still reuse the existing object-clone & object-merge I did on dmail-old repository

/*
something to keep in mind

a = {
    user: {
        name: 'dam'
    }
}
b = {
    user: {
        name: 'seb',
        age: 10
    }
}

saying I want to merge a & b does not necessarily mean every subproperty strategy is set to "ignore" (b property replaces a property)
this is just the default behaviour but we may want to specify deeply how user.name: 'seb' merge conflict is handled such as the final object would be

{
    user: {
        name: 'dam',
        age: 10
    }
}

to do this the resolve method must allow to set nested property strategy such as :
b.resolve({
    'user': 'merge',
    'user.name': 'ignore'
});

and property.value must be parsed to discover nested property
and we must also detect circular structure to prevent infinite loop (in other wors reimplement lab.js without unit.js to help :/)
*/
function mergeValue(firstValue, secondValue, deep) {
    return deep;
}

Resolver.register('merge', {
    propertyMatcher: 'any',
    constructor(deep) {
        this.deep = deep;
    },
    deep: true,
    resolveLater(property, conflictualProperty) {
        const deep = this.deep;
        const descriptor = property.descriptor;
        const conflictualDescriptor = conflictualProperty.descriptor;
        const mergedDescriptor = {};
        const mergedProperty = property.createConstructor(property.name);

        let situation = descriptor.hasOwnProperty('value') ? 'value' : 'accessor';
        situation += '-';
        situation += conflictualDescriptor.descriptor.hasOwnProperty('value') ? 'value' : 'accessor';

        if (situation === 'value-value') {
            mergedDescriptor.writable = conflictualDescriptor.writable;
            mergedDescriptor.enumerable = conflictualDescriptor.enumerable;
            mergedDescriptor.configurable = conflictualDescriptor.configurable;
            // both value are merged
            mergedDescriptor.value = mergeValue(descriptor.value, conflictualDescriptor.value, deep);
        } else if (situation === 'accessor-value') {
            mergedDescriptor.writable = conflictualDescriptor.writable;
            mergedDescriptor.enumerable = conflictualDescriptor.enumerable;
            mergedDescriptor.configurable = conflictualDescriptor.configurable;
            // accessor is lost, value is kept
            mergedDescriptor.value = conflictualDescriptor.value;
        } else if (situation === 'value-accessor') {
            mergedDescriptor.enumerable = conflictualDescriptor.enumerable;
            mergedDescriptor.configurable = conflictualDescriptor.configurable;
            // value is lost, accessor are kept
            if (conflictualDescriptor.hasOwnProperty('get')) {
                mergedDescriptor.get = conflictualDescriptor.get;
            }
            if (conflictualDescriptor.hasOwnProperty('set')) {
                mergedDescriptor.set = conflictualDescriptor.set;
            }
        } else if (situation === 'accessor-accessor') {
            mergedDescriptor.enumerable = conflictualDescriptor.enumerable;
            mergedDescriptor.configurable = conflictualDescriptor.configurable;
            // both accessor are merged
            if (conflictualDescriptor.hasOwnProperty('get')) {
                if (descriptor.hasOwnProperty('get')) {
                    mergedDescriptor.get = mergeValue(descriptor.get, conflictualDescriptor.get, deep);
                } else {
                    mergedDescriptor.get = conflictualDescriptor.get;
                }
            }
            if (conflictualDescriptor.hasOwnProperty('set')) {
                if (descriptor.hasOwnProperty('set')) {
                    mergedDescriptor.set = mergeValue(descriptor.set, conflictualDescriptor.set, deep);
                } else {
                    mergedDescriptor.set = conflictualDescriptor.set;
                }
            }
        }

        mergedProperty.descriptor = mergedDescriptor;

        return mergedProperty;
    }
});
