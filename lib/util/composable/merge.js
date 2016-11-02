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
    BooleanElement,
    NumberElement,
    NullElement,
    UndefinedElement,
    ObjectElement,
    ObjectPropertyElement,
    FunctionObjectElement
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
    // if first function is a Function fragment it will work without having to do anything
    // because we use compile() & clone() which are available on both
    const functionFragment = FunctionObjectElement.create();

    if (compositionHandler) {
        functionFragment.appendChild(firstFunction.clone());
        functionFragment.appendChild(FunctionObjectElement.create().write(compositionHandler));
        functionFragment.appendChild(secondFunction.clone());

        functionFragment.compile = function() {
            const fragmentFirstChild = this.children[0].compile();
            const fragmentMiddleChild = this.children[1].compile();
            const fragmentLastChild = this.children[2].compile();

            return function() {
                return fragmentMiddleChild.call(this, fragmentFirstChild, fragmentLastChild, arguments, this);
            };
        };
    } else {
        functionFragment.appendChild(firstFunction.clone());
        functionFragment.appendChild(secondFunction.clone());

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
        // if (element.resolver.name === 'replace') {
        //     throw new Error('cannot replace both, only one must remain');
        // }
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

ResolverStore.register('concat', {
    elementMatcher: 'stringOrArray',
    conflictualElementMatcher: 'sameAsElement',
    resolverLater(stringOrArrayElement, stringOrArrayConflictualElement) {
        // we are missing the baility to say : both String -> concat, first isString second is Number -> replace
        // right now we can only use oneResolver which is not sufficient
        // concatenation could be better in term of perf if we had a concat method on element
        // moreover concatening data & not element will ignore property which are not entry on array for instance
        const concatenedData = stringOrArrayElement.data.concat(stringOrArrayConflictualElement.data);
        return stringOrArrayElement.clone().write(concatenedData);
    }
});

// concat array and deep clone the merged array entries
ResolverStore.register('concatDeep', {

});

// would also imagine a resolver which adds number, multiply them, divide them etc
// the amount of possible resolver is infinite and we must provide an api
// allowing to use different resolver depending on the element AND the conflictualElement (and not a resolver per element ignoring the conflictual one)
/*
- resolver may say hey I'm working with a first argument which is a function and a second is a string
to make it simple if a resolver has many signature it must be expressed by polymorphism

on a aussi besoin ensuite de pouvoir dire voici la liste des résolveurs associé à cet élement
donc en gros le premier resolver qui match on l'utilise

ResolverStore.register('concat', [
    bothElementAre('string'),
    function(stringElement, conflictualStringElement) {
        return stringElement.concat(conflictualStringElement);
    },

    bothElementAre('array'),
    function(arrayElement, conflictualArrayElement) {
        return arrayElement.concat(conflictualArrayElement);
    }
]);

ResolverStore.register('replace', {
    any(),
    function(element, otherElement) {
        return element.replace(otherElement.clone());
    }
});

later you would can do

var el = Lab.scan({name: 'dam'});
// first try to concat else replace
el.select('name', 'value').resolveBy('concat', 'replace');
// ok c'est cool mais comment je vais faire moi plus tard pour faire en sorte que résoudre un élement soit immutable ?
// en gros faudrais que je parte de l'élement cloner puis que je fasse select puis resolve
// ici il manque aussi un moyen moins contraignant d'exprimer les merge resolvers

// si les deux value à merger sont des chaines alors concat les
// sinon on utilisera le resolveur par défaut
el.select('name', 'value').resolveBy(
    function(current, next) { return typeof current.data === 'string' && typeof next.data === 'string' },
    function(current, next) { return Lab.scan(current.data + next.data); }
});

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

mergeProperties, mergeProperty, concat & concatDeep could all be renamed 'concat' or 'merge'
but for array it means append array at the end and merge properties
for property it means merge their values
deep would be true by default and you could pass it to false in some way
when set to false it means we do not merge descendant we just add them as they are
*/

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

NullElement.refine({
    resolver: ResolverStore.get('replace')
});
UndefinedElement.refine({
    resolver: ResolverStore.get('replace')
});
BooleanElement.refine({
    resolver: ResolverStore.get('replace')
});
NumberElement.refine({
    resolver: ResolverStore.get('replace')
});
StringElement.refine({
    resolver: ResolverStore.get('replace')
});
ObjectElement.refine({
    resolver: ResolverStore.get('mergeProperties')
});
ObjectPropertyElement.refine({
    resolver: ResolverStore.get('mergeProperty')
});
FunctionObjectElement.refine({
    resolver: ResolverStore.get('replace')
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
