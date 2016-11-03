/* eslint-disable no-use-before-define */

// can we just add an infected compose() which is aware of conflict and tries to handle them ?
// anyway we need to handle conflict between constructor() method which must by default register every method
// and later set a specific constructor method that will execute sequentially every constructor and return first non null returned value
// or the object on which unit is produced (can be a custom object if you do unit.produceOn() instead of produce())

import util from './util.js';
// import Lab from './lab.js';
import {
    Element,
    StringElement,
    // BooleanElement,
    NumberElement,
    // NullElement,
    // UndefinedElement,
    // ObjectElement,
    // ObjectPropertyElement,
    FunctionObjectElement,
    ArrayObjectElement
} from './lab.js';

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
    },

    get(name) {
        return this.resolvers.find(function(resolver) {
            return resolver.name === name;
        });
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

    resolveLater() {
        throw new Error('merge conflict must be handled');
    }
});

// now we define many resolver that can be used by element and even configured later
const ResolverMatcher = util.extend({
    register() {}
});
// any element can use the 'any' resolver
ResolverMatcher.register('any', {
    match() {
        return true;
    }
});
// only element being function can use this resolver
ResolverMatcher.register('function', {
    match(element) {
        return FunctionObjectElement.isPrototypeOf(element);
    }
});

ResolverStore.register('initial', {
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
    let functionFragment;

    if (compositionHandler) {
        const surroundedElement = FunctionObjectElement.create().write(compositionHandler);
        functionFragment = surroundedElement.surround(firstFunction, secondFunction);
    } else {
        functionFragment = firstFunction.append(secondFunction);
    }

    return functionFragment;
}

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
        return element.replace(conflictualElement.clone());
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
        // hardcoded to simpler version for now
        objectPropertyElement.children[0].merge(conflictualObjectPropertyElement.children[0]);
        return objectPropertyElement;

        // const selfDescriptor = objectPropertyElement.descriptor;
        // const otherDescriptor = conflictualObjectPropertyElement.descriptor;

        // let situation = selfDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';
        // situation += '-';
        // situation += otherDescriptor.descriptor.hasOwnProperty('value') ? 'value' : 'accessor';

        // if (situation === 'value-value') {
        //     selfDescriptor.writable = otherDescriptor.writable;
        //     selfDescriptor.enumerable = otherDescriptor.enumerable;
        //     selfDescriptor.configurable = otherDescriptor.configurable;

        //     // merge values
        //     objectPropertyElement.valueNode.merge(conflictualObjectPropertyElement.valueNode);
        // } else if (situation === 'accessor-value') {
        //     selfDescriptor.writable = otherDescriptor.writable;
        //     selfDescriptor.enumerable = otherDescriptor.enumerable;
        //     selfDescriptor.configurable = otherDescriptor.configurable;

        //     // remove accessors
        //     const getterNode = objectPropertyElement.getterNode;
        //     if (getterNode) {
        //         getterNode.remove();
        //         delete objectPropertyElement.getterNode;
        //         delete selfDescriptor.get;
        //     }
        //     const setterNode = objectPropertyElement.setterNode;
        //     if (setterNode) {
        //         setterNode.remove();
        //         delete objectPropertyElement.setterNode;
        //         delete selfDescriptor.set;
        //     }
        //     // use value
        //     objectPropertyElement.valueNode = objectPropertyElement.createNode();
        //     objectPropertyElement.valueNode.import(conflictualObjectPropertyElement.valueNode);
        //     selfDescriptor.value = objectPropertyElement.valueNode.value;
        // } else if (situation === 'value-accessor') {
        //     selfDescriptor.enumerable = otherDescriptor.enumerable;
        //     selfDescriptor.configurable = otherDescriptor.configurable;

        //     // remove value
        //     objectPropertyElement.valueNode.remove();
        //     delete objectPropertyElement.valueNode;
        //     delete selfDescriptor.value;
        //     // use accessor
        //     const getterNode = conflictualObjectPropertyElement.getterNode;
        //     if (getterNode) {
        //         objectPropertyElement.getterNode = objectPropertyElement.createNode();
        //         objectPropertyElement.getterNode.import(getterNode);
        //         selfDescriptor.get = getterNode.value;
        //     }
        //     const setterNode = conflictualObjectPropertyElement.setterNode;
        //     if (setterNode) {
        //         objectPropertyElement.setterNode = objectPropertyElement.createNode();
        //         objectPropertyElement.setterNode.import(setterNode);
        //         selfDescriptor.set = setterNode.value;
        //     }
        // } else if (situation === 'accessor-accessor') {
        //     selfDescriptor.enumerable = otherDescriptor.enumerable;
        //     selfDescriptor.configurable = otherDescriptor.configurable;

        //     // merge accessors
        //     const getterNode = conflictualObjectPropertyElement.getterNode;
        //     if (getterNode) {
        //         let selfGetterNode = objectPropertyElement.getterNode;
        //         if (selfGetterNode) {
        //             selfGetterNode.merge(getterNode);
        //         } else {
        //             selfGetterNode = objectPropertyElement.createNode();
        //             objectPropertyElement.getterNode = selfGetterNode;
        //             selfGetterNode.import(getterNode);
        //         }
        //         selfDescriptor.get = selfGetterNode.value;
        //     }
        //     const setterNode = conflictualObjectPropertyElement.setterNode;
        //     if (setterNode) {
        //         let selfSetterNode = objectPropertyElement.setterNode;
        //         if (selfSetterNode) {
        //             selfSetterNode.merge(getterNode);
        //         } else {
        //             selfSetterNode = objectPropertyElement.createNode();
        //             objectPropertyElement.setterNode = selfSetterNode;
        //             selfSetterNode.import(getterNode);
        //         }
        //         selfDescriptor.get = selfSetterNode.value;
        //     }
        // }
        //
        // return objectPropertyElement;
    }
});

Element.refine({
    resolve(mergeConflictResolver) {
        const resolvedElement = this.clone();
        resolvedElement.resolver = mergeConflictResolver;
        mergeConflictResolver.resolveNow(this);
        return resolvedElement;
    },

    createFragment() {
        const fragment = this.createConstructor();
        fragment.compile = function() {
            const childrenCompileResult = this.children.map(function(child) {
                return child.compile();
            });

            if (childrenCompileResult.length === 2) {
                return this.transformCombinedFragment(...childrenCompileResult);
            }
            return this.transformSurroundedFragment(...childrenCompileResult);
        };
        return fragment;
    },

    transformFragment() {
        throw new Error('unimplemented transformFragment');
    },

    prepend(element) {
        const fragment = this.createFragment();
        this.replace(fragment);
        fragment.appendChild(element.clone());
        fragment.appendChild(this);
        return fragment;
    },

    append(element) {
        const fragment = this.createFragment();
        this.replace(fragment);
        fragment.appendChild(this);
        fragment.appendChild(element.clone());
        return fragment;
    },

    surround(previousElement, nextElement) {
        const fragment = this.createFragment();
        this.replace(fragment);
        fragment.appendChild(previousElement.clone());
        fragment.appendChild(this);
        fragment.appendChild(nextElement.clone());
        return fragment;
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

        const resolver = this.resolver;
        if (!resolver) {
            console.log(this);
            throw new Error('element has no resolver');
        }

        const mergedElement = resolver.resolveLater(
            this,
            element
        );
        // let returnedElement;
        // if (mergedElement) {
        //     returnedElement = mergedElement;

        //     if (mergedElement === this) {
        //         // nothing to do
        //     } else {
        //         this.replace(mergedElement);
        //     }
        // } else {
        //     // what does it mean ? for now it means do nothing
        //     // we may throw instead
        //     returnedElement = this;
        // }

        return mergedElement;
    },

    compose(element) {
        // perf : maybe depending on the operation happening on this.merge we may not have to clone
        return this.clone().merge(element);
    }
});

FunctionObjectElement.refine({
    transformCombinedFragment(firstFunction, secondFunction) {
        return function() {
            firstFunction.apply(this, arguments);
            return secondFunction.apply(this, arguments);
        };
    },

    transformSurroundedFragment(firstFunction, secondFunction, thirdFunction) {
        return function() {
            return secondFunction.call(this, firstFunction, thirdFunction, arguments, this);
        };
    }
});
StringElement.refine({
    transformCombinedFragment(firstString, secondString) {
        return firstString + secondString; // could also bre written firstString.concat(secondString);
    }
});
ArrayObjectElement.refine({
    transformCombinedFragment(firstArray, secondArray) {
        firstArray.push(...secondArray);
        return firstArray;
    }
});
NumberElement.refine({
    // we need more option like - / Math.pow etc to combine two number
    transformCombinedFragment(firstNumber, secondNumber) {
        return firstNumber + secondNumber;
    }
});

/*
// I suppose null, undefined, true/false, may not be combined
// however object may be combined in the same fashion instead of using mergeProperties we could
// create objectFragment (by default mergeProperties would mean append)
// prepend would allow a great feature which is to put merged object properties first
// instead of the opposite
// a major incredible nice feature would be that we would not lost the composed object until they are compiled
// while current implementation was keeping only one object that replaces the other
// but replace would remain a valid use case however replace, unlink append removes completely the replaced element
// ok now what means objectProperty.append(otherObjectProperty)
// for this case it does not make sens to keep both property

donc c'est super mais je vois un problème:

objectA.merge(objectB)
ok on créer une sorte d'object composite du genre
objectC = [objectA, objectB]
par contre c'est relou parce qu'on ignore complètement si les propriétés vont collisioner
cela pourrait se faire à la compilation mais est-ce correct de voir les choses comme ça je ne sais pas

pour les functions c'est ok parce qu'on apelle une fonction après l'autre par ex

pour les object il ne peut y avoir qu'un object et donc les propriétés peuvent clasher
dans transformCombinedFragment on ferais en gros un Object.assign() mais du coup on perds la possibilité de détecter les conflicts
on pourrait avoir un cas particulier pour les objets, ce sera à réfléchir

il faudrais activer ou non prepend/append/surround en fonction de chaque element
certain supporte aucune, une partie ou toutes ces méthodes
*/

// would also imagine a resolver which adds number, multiply them, divide them etc
// the amount of possible resolver is infinite and we must provide an api
// allowing to use different resolver depending on the element AND the conflictualElement (and not a resolver per element ignoring the conflictual one)
/*
- resolver may say hey I'm working with a first argument which is a function and a second is a string
to make it simple if a resolver has many signature it must be expressed by polymorphism

on a aussi besoin ensuite de pouvoir dire voici la liste des résolveurs associé à cet élement
donc en gros le premier resolver qui match on l'utilise

// on pourrait avoir une sorte de merge conflict resolution config par élement qui dit
// pour moi même et mes descendants voici la config en cas de merge conflict
// et chaque element descendant peut override cette config et en hérite par défaut (genre CSS)
// sauf que cette info devrait être mise sur Element puisque tous les sous éléments en hérite
mais ce n'est actuellement pas possible de redéfinir ça quand on veut ou alors faudrais Element.config
qui pourrais être override par String.config override elle-même par string.config
ignorons ce problème pour le moment qui est bien avancé et mettons en place comme si c'était bon sur Element.config

la config par défaut serais kk chose comme

(primitive means : String, Number, Boolean, Symbol, Null, Undefined)

I think i'll just use a function here that will be used by every element (nope else I cannot specifiy how a specific value merge...)

if (element.resolver) {
    return element.resolver;
}

if (oneOf(element, [NullElement, UndefinedElement, NumberElement, BooleanElement, StringElement, SymbolElement])) {
    return replaceResolver;
}

if (are(element, conflictualElement, ObjectElement)) {
    return mergePropertiesResolver;
}

if (are(element, conflictualElement, ObjectPropertyElement)) {
    return mergePropertyResolver;
}

if (is(element, FunctionObjectElement)) {
    return replaceResolver;
}

if (are(element, conflictualElement, ArrayObjectElement)) {
    return concatResolver + mergePropertiesResolver;
}

if (is(element, ArrayElement) && is(element, ObjectElement)) {
    return mergePropertiesResolver;
}

return throwResolver;
*/
