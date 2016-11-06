/* eslint-disable no-use-before-define */

// can we just add an infected compose() which is aware of conflict and tries to handle them ?
// anyway we need to handle conflict between constructor() method which must by default register every method
// and later set a specific constructor method that will execute sequentially every constructor and return first non null returned value
// or the object on which unit is produced (can be a custom object if you do unit.produceOn() instead of produce())

// import util from './util.js';
// import Lab from './lab.js';
import {
    Element,
    NullElement,
    UndefinedElement,
    BooleanElement,
    NumberElement,
    StringElement,
    ObjectElement,
    ObjectPropertyElement,
    FunctionObjectElement,
    ArrayObjectElement
} from './lab.js';

Element.refine({
    copy(destinationElement) {
        const clone = this.clone(false);

        destinationElement.appendChild(clone); // this is where the conflict may happen
        this.children.forEach(function(child) {
            child.copy(clone);
        });

        return clone;
    },

    compose(element) {
        let composedElement = this.createComposedElement(element);
        return composedElement.combine();
    },

    createComposedElement(secondElement) {
        let firstElement = this;
        let composedElement;
        const combine = this.combine;

        if (combine === 'replace') {
            composedElement = secondElement.clone(false);
            composedElement.combine = function() {
                secondElement.children.forEach(function(child) {
                    child.copy(this);
                }, this);
                return this;
            };
        } else if (combine === 'ignore') {
            composedElement = firstElement.clone(false);
            composedElement.combine = function() {
                firstElement.children.forEach(function(child) {
                    child.copy(this);
                }, this);
                return this;
            };
        } else {
            composedElement = firstElement.clone(false);
            composedElement.combine = function() {
                return combine.call(this, firstElement, secondElement);
            };
        }

        return composedElement;
    },

    // combine(firstElement, seondElement) est une sorte de fill(value)
    // sauf que les arguments sont des éléments et y'en a deux
    // mais l'idée est la même: set l'état d'un objet Element supposé vide à partir d'autre états
    combine(firstElement, secondElement) {
        const combinedElement = this;
        const value = firstElement.value;
        const valueToCombine = secondElement.value;
        const combinedValue = this.combineValue(value, valueToCombine);

        combinedElement.firstComponent = firstElement;
        combinedElement.secondComponent = secondElement;
        combinedElement.data = combinedValue;

        // copy all child of firstElement then copy all child of secondElement
        // during these operation conflict may happen bewteen existing child and copied child
        // in such case we'll have to compose child as well
        firstElement.children.forEach(function(child) {
            child.copy(combinedElement);
        });
        secondElement.children.forEach(function(child) {
            child.coppy(combinedElement);
        });

        return combinedElement;
    }
});
// any element must be configurable to say it use replace composition strategy or a combine()
// composition strategy but the default are the following
NullElement.refine({
    combine: 'replace'
});
UndefinedElement.refine({
    combine: 'replace'
});
BooleanElement.refine({
    combine: 'replace'
});
NumberElement.refine({
    combineValue(firstNumber, secondNumber) {
        return firstNumber + secondNumber;
    }
});
StringElement.refine({
    combineValue(firstString, secondString) {
        return firstString + secondString;
    }
});
ObjectElement.refine({
    combineValue() {
        // combining two objects result into one object
        return {};
    }
});
ObjectPropertyElement.refine({
    combine(firstObjectPropertyElement, secondObjectPropertyElement) {
        // hardcoded to simpler version for now

        const combinedProperty = this;
        const firstPropertyValueNode = firstObjectPropertyElement.children[0];
        const secondPropertyValueNode = secondObjectPropertyElement.children[0];
        const composedPropertyValue = firstPropertyValueNode.createComposedElement(secondPropertyValueNode);
        // put the composedProperty value in the tree before combining it
        combinedProperty.appendChild(composedPropertyValue);
        composedPropertyValue.combine();

        return combinedProperty;

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
FunctionObjectElement.refine({
    combineValue(firstFunction, secondFunction) {
        return function() {
            firstFunction.apply(this, arguments);
            return secondFunction.apply(this, arguments);
        };
    }
    // transformSurroundedFragment(firstFunction, secondFunction, thirdFunction) {
    //     return function() {
    //         return secondFunction.call(this, firstFunction, thirdFunction, arguments, this);
    //     };
    // }
});
ArrayObjectElement.refine({
    combineValue() {
        // combining two array creates an array
        return [];
    }
});

/*
Element.refine({
    // resolve(mergeConflictResolver) {
    //     const resolvedElement = this.clone();
    //     resolvedElement.resolver = mergeConflictResolver;
    //     mergeConflictResolver.resolveNow(this);
    //     return resolvedElement;
    // },

    // createFragment() {
    //     const fragment = this.createConstructor();
    //     fragment.compile = function() {
    //         const childrenCompileResult = this.children.map(function(child) {
    //             return child.compile();
    //         });

    //         if (childrenCompileResult.length === 2) {
    //             return this.transformCombinedFragment(...childrenCompileResult);
    //         }
    //         return this.transformSurroundedFragment(...childrenCompileResult);
    //     };
    //     return fragment;
    // },

    // transformFragment() {
    //     throw new Error('unimplemented transformFragment');
    // },

    // prepend(element) {
    //     const fragment = this.createFragment();
    //     this.replace(fragment);
    //     fragment.appendChild(element.clone());
    //     fragment.appendChild(this);
    //     return fragment;
    // },

    // append(element) {
    //     const fragment = this.createFragment();
    //     this.replace(fragment);
    //     fragment.appendChild(this);
    //     fragment.appendChild(element.clone());
    //     return fragment;
    // },

    // surround(previousElement, nextElement) {
    //     const fragment = this.createFragment();
    //     this.replace(fragment);
    //     fragment.appendChild(previousElement.clone());
    //     fragment.appendChild(this);
    //     fragment.appendChild(nextElement.clone());
    //     return fragment;
    // }
});
*/

/*
// I suppose null, undefined, true/false, may not be combined
// however object may be combined in the same fashion instead of using mergeProperties we could
// create objectFragment (by default mergeProperties would mean append)
// prepend would allow a great feature which is to put merged object properties first

donc c'est super mais je vois un problème:

objectA.merge(objectB)
ok on créer une sorte d'object composite du genre
objectC = [objectA, objectB]
par contre c'est relou parce qu'on ignore complètement si les propriétés vont collisioner
cela pourrait se faire à la compilation mais est-ce correct de voir les choses comme ça je ne sais pas
si je crée une version combiné des deux objets je perd data ou alors au moment de créer le object fragment
on aura effectivement objectFragment = [objectA, objectB]
ok non en fait voilà ce qu'il se passe : on merge direct
objectA et objectB disparait au profit de objectC qui est un object utilisant les propriété de A et B mergé
cas particulier:
objectA.self = objectA, objectB.me = objectB
alors objectC.self === objectC & objectC.me === objectC

même function et string devrait faire ça : devenir une seule entité immédiatemment et pas à la compilation
compile ne feras que retourner la fonction cmoposé ou un clone de la fonction composé
pareil pour les objet: créer un clone de l'objet composé
le seul truc qu'il faudrait garde c'est que si on veut serialize la fonction correspondante il faut connaitre
les fonction qui compose la fonction finale, si on compose et qu'on perd cette info on ne peut plus serialize
il faudrais peut être conserver quelque chose comme la source de la fonction comme une propriété de ladite fonction de sorte
qu'on peut combiner cette propriété pour la version composé ? ou quelque chose comme ça (et la combination des sources résulterait en un tableau)
de plus les références vers les object non combiné devrait toutes pointer vers les objets combiné est ce seulement possible

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

// const ResolverStore = {
//     resolvers: [],

//     from(value) {
//         let resolver;
//         for (let Resolver of this.resolvers) {
//             resolver = Resolver.from(value);
//             if (resolver) {
//                 break;
//             }
//         }
//         return resolver;
//     },

//     register(name, methods) {
//         const resolver = Resolver.extend({
//             name: name
//         }, methods);
//         this.resolvers.push(resolver);
//         return resolver;
//     },

//     get(name) {
//         return this.resolvers.find(function(resolver) {
//             return resolver.name === name;
//         });
//     }
// };

// const Resolver = util.extend({
//     from(value) {
//         const name = this.name;
//         if (typeof value === 'string') {
//             if (value === name) {
//                 return this.create();
//             }
//         } else if (typeof value === 'object') {
//             if (name in value) {
//                 return this.create(value[name]);
//             }
//         }
//     },
//     name: '',

//     resolveNow() {

//     },

//     resolveLater() {
//         throw new Error('merge conflict must be handled');
//     }
// });

// function composeFunction(firstFunction, secondFunction, compositionHandler) {
//     let functionFragment;

//     if (compositionHandler) {
//         const surroundedElement = FunctionObjectElement.create().write(compositionHandler);
//         functionFragment = surroundedElement.surround(firstFunction, secondFunction);
//     } else {
//         functionFragment = firstFunction.append(secondFunction);
//     }

//     return functionFragment;
// }

// ResolverStore.register('replace', {
//     elementMatcher: 'any',
//     resolveLater(element, conflictualElement) {
//         return element.replace(conflictualElement.clone());
//     }
// });

// rename must be available only for objectPropertyElement
// ResolverStore.register('rename', {
//     constructor(renameWith) {
//         this.renameWith = renameWith;
//     },
    // elementMatcher: 'any'
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
// });
