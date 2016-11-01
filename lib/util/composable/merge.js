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
import Lab from './lab.js';
import {Element} from './lab.js';

const FunctionElement = Lab.findElementByName('function');
const ObjectElement = Lab.findElementByName('object');
const ObjectPropertyElement = Lab.findElementByName('objectProperty');

const ResolverStore = {
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
        const resolver = Resolver.extend({
            name: name
        }, methods);
        this.resolvers.push(resolver);
        return resolver;
    }
};

const Resolver = util.extend({
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

    resolveNow() {

    },

    resolveLater(element, conflictualElement) {
        function createConflictError() {

        }

        throw createConflictError(
            conflictualElement,
            'merge conflict must be handled'
        );
    }
});

// now we define many resolver that can be used by element and even configured later
const ResolverMatcher = util.extend();
// any element can use the 'any' resolver
ResolverMatcher.register('any', {
    match() {
        return true;
    }
});
// only element being function can use this resolver
ResolverMatcher.register('function', {
    match(element) {
        return FunctionElement.isPrototypeOf(element);
    }
});

Resolver.register('initial', {
    elementMatcher: 'any',
    resolveNow(element) {
        delete element.resolver;
    }
});

ResolverStore.register('after', {
    elementMatcher: 'function',
    conflictualElementMatcher: 'function',
    resolveLater(functionElement, conflictualFunctionElement) {
        return composeFunction(functionElement, conflictualFunctionElement);
    }
});
ResolverStore.register('before', {
    elementMatcher: 'function',
    conflictualElementMatcher: 'function',
    resolveLater(functionElement, conflictualFunctionElement) {
        return composeFunction(conflictualFunctionElement, functionElement);
    }
});
ResolverStore.register('around', {
    constructor(around) {
        this.around = around;
    },
    elementMatcher: 'function',
    conflictualElementMatcher: 'function',
    resolveLater(functionElement, conflictualFunctionElement) {
        return composeFunction(functionElement, conflictualFunctionElement, this.around);
    }
});
function composeFunction(firstFunction, secondFunction, compositionHandler) {
    // if first function is a Function fragment it will work without having to do anything
    // because we use compile() & clone() which are available on both
    const functionFragment = FunctionElement.create();

    if (compositionHandler) {
        functionFragment.compile = function() {
            const fragmentFirstChild = this.children[0].compile();
            const fragmentMiddleChild = this.children[1].compile();
            const fragmentLastChild = this.children[2].compile();

            return function() {
                return fragmentMiddleChild.call(this, fragmentFirstChild, fragmentLastChild, arguments, this);
            };
        };

        functionFragment.appendChild(firstFunction.clone());
        functionFragment.appendChild(FunctionElement.create().write(compositionHandler));
        functionFragment.appendChild(secondFunction.clone());
    } else {
        functionFragment.compile = function() {
            const fragmentFirstChild = this.children[0].compile();
            const fragmentLastChild = this.children[1].compile();

            return function() {
                fragmentFirstChild.apply(this, arguments);
                return fragmentLastChild.apply(this, arguments);
            };
        };
    }

    return functionFragment;
}

// ResolverStore.register('remove', {
//     elementMatcher: 'any',
//     resolveLater() {
//         // removing the node how to do that ?
//     }
// });

ResolverStore.register('ignore', {
    elementMatcher: 'any',
    resolveLater(element) {
        // noop
        return element;
    }
});

ResolverStore.register('replace', {
    elementMatcher: 'any',
    resolveLater(element, conflictualElement) {
        if (element.resolver.name === 'replace') {
            throw new Error('cannot replace both, only one must remain');
        }
        // console.log(
        //     'resolving by replace to',
        //     property.descriptor.value.toString(),
        //     'conflictual is',
        //     conflictualProperty.descriptor.value.toString()
        // );
        return conflictualElement.clone();
    }
});

// rename must be available only for objectPropertyElement
ResolverStore.register('rename', {
    constructor(renameWith) {
        this.renameWith = renameWith;
    },
    elementMatcher: 'any'
    // ne pas utiliser resolveNow maintenant y'a que un resolveLater qui peut être dynamique
    // resolveNow(element, properties, conflictResolverMap) {
    //     let resolvedProperty;
    //     const renameWith = this.renameWith;

    //     // property.name = renameWith;
    //     // check if rename creates an internal conflict
    //     const conflictualProperty = properties.get(renameWith);

    //     if (conflictualProperty) {
    //         var message = 'conflict must not be handled by renaming "' + property.name + '" -> "' + renameWith;
    //         message += '" because it already exists';
    //         let error = property.createConflictError(
    //             conflictualProperty,
    //             message,
    //             'resolve({rename: \'' + renameWith + '-free\'})'
    //         );
    //         throw error;
    //     } else {
    //         const renamedProperty = property.rename(renameWith);
    //         resolvedProperty = properties.resolveProperty(renamedProperty, conflictResolverMap);
    //     }

    //     return resolvedProperty;
    // }
});

// must be available only for ObjectElement
ResolverStore.register('mergeProperties', {
    resolveLater(objectElement, conflictualObjectElement) {
        const mergedObjectElement = objectElement.clone();
        for (let property of conflictualObjectElement) {
            mergedObjectElement.addProperty(property);
        }
        return mergedObjectElement;
    }
});

// must be available only for ObjectPropertyElement
ResolverStore.register('mergeProperty', {
    resolveLater(objectPropertyElement, conflictualObjectPropertyElement) {
        const selfDescriptor = objectPropertyElement.descriptor;
        const otherDescriptor = conflictualObjectPropertyElement.descriptor;

        let situation = selfDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';
        situation += '-';
        situation += otherDescriptor.descriptor.hasOwnProperty('value') ? 'value' : 'accessor';

        if (situation === 'value-value') {
            selfDescriptor.writable = otherDescriptor.writable;
            selfDescriptor.enumerable = otherDescriptor.enumerable;
            selfDescriptor.configurable = otherDescriptor.configurable;

            // merge values
            this.valueNode.merge(conflictualObjectPropertyElement.valueNode);
        } else if (situation === 'accessor-value') {
            selfDescriptor.writable = otherDescriptor.writable;
            selfDescriptor.enumerable = otherDescriptor.enumerable;
            selfDescriptor.configurable = otherDescriptor.configurable;

            // remove accessors
            const getterNode = this.getterNode;
            if (getterNode) {
                getterNode.remove();
                delete this.getterNode;
                delete selfDescriptor.get;
            }
            const setterNode = this.setterNode;
            if (setterNode) {
                setterNode.remove();
                delete this.setterNode;
                delete selfDescriptor.set;
            }
            // use value
            this.valueNode = this.createNode();
            this.valueNode.import(conflictualObjectPropertyElement.valueNode);
            selfDescriptor.value = this.valueNode.value;
        } else if (situation === 'value-accessor') {
            selfDescriptor.enumerable = otherDescriptor.enumerable;
            selfDescriptor.configurable = otherDescriptor.configurable;

            // remove value
            this.valueNode.remove();
            delete this.valueNode;
            delete selfDescriptor.value;
            // use accessor
            const getterNode = conflictualObjectPropertyElement.getterNode;
            if (getterNode) {
                this.getterNode = this.createNode();
                this.getterNode.import(getterNode);
                selfDescriptor.get = getterNode.value;
            }
            const setterNode = conflictualObjectPropertyElement.setterNode;
            if (setterNode) {
                this.setterNode = this.createNode();
                this.setterNode.import(setterNode);
                selfDescriptor.set = setterNode.value;
            }
        } else if (situation === 'accessor-accessor') {
            selfDescriptor.enumerable = otherDescriptor.enumerable;
            selfDescriptor.configurable = otherDescriptor.configurable;

            // merge accessors
            const getterNode = conflictualObjectPropertyElement.getterNode;
            if (getterNode) {
                let selfGetterNode = this.getterNode;
                if (selfGetterNode) {
                    selfGetterNode.merge(getterNode);
                } else {
                    selfGetterNode = this.createNode();
                    this.getterNode = selfGetterNode;
                    selfGetterNode.import(getterNode);
                }
                selfDescriptor.get = selfGetterNode.value;
            }
            const setterNode = conflictualObjectPropertyElement.setterNode;
            if (setterNode) {
                let selfSetterNode = this.setterNode;
                if (selfSetterNode) {
                    selfSetterNode.merge(getterNode);
                } else {
                    selfSetterNode = this.createNode();
                    this.setterNode = selfSetterNode;
                    selfSetterNode.import(getterNode);
                }
                selfDescriptor.get = selfSetterNode.value;
            }
        }

        return objectPropertyElement;
    }
});

// must be set on string, boolean, null, undefined too
FunctionElement.refine({
    resolver: ResolverStore.get('replace')
});

ObjectElement.refine({
    resolver: ResolverStore.get('mergeProperties')
});

ObjectPropertyElement.refine({
    resolver: ResolverStore.get('mergeProperty')
});

Element.refine({
    resolve(mergeConflictResolver) {
        const resolvedElement = this.clone();
        resolvedElement.resolver = mergeConflictResolver;
        mergeConflictResolver.resolveNow(this);
        return resolvedElement;
    },

    merge(element) {
        // const selfResolver = this.resolver;
        // const otherResolver = element.resolver;
        // const selfResolverName = selfResolver.name;
        // const otherResolverName = otherResolver.name;
        // let elementResponsibleToResolve;

        // if (element.hasOwnProperty('resolver')) {
        //     elementResponsibleToResolve = element;
        // } else if (this.hasOwnProperty('resolver')) {
        //     elementResponsibleToResolve = this;
        // } else {
        //     elementResponsibleToResolve = element;
        // }

        // let conflictualElement;
        // if (elementResponsibleToResolve === this) {
        //     conflictualElement = element;
        // } else {
        //     conflictualElement = this;
        // }

        const mergedElement = this.resolver.resolveLater(
            this,
            element
        );
        let returnedElement;

        if (mergedElement) {
            returnedElement = mergedElement;

            if (mergedElement === this) {
                // nothing to do
            } else {
                this.replace(mergedElement);
            }
        } else {
            // what does it mean ? for now it means do nothing
            // we may throw instead
            returnedElement = this;
        }

        return returnedElement;
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
