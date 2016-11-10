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
    ArrayObjectElement,
    ArrayObjectPropertyElement,
    FunctionObjectElement,
    RegExpObjectElement,
    DateObjectElement,
    ErrorObjectElement
} from './lab.js';

Element.refine({
    compose(secondElement) {
        const conflict = this.conflict(secondElement);
        conflict.resolve();
        return conflict.element;
    },

    conflict(secondElement) {
        const firstElement = this.asElement();
        let conflict = {};
        let resolutionMethod;
        let resolutionMethodElement;
        let resolutionMethodArgs;

        if (secondElement) {
            const conflictResolutionStrategy = firstElement.conflictResolutionStrategy;

            if (conflictResolutionStrategy === 'replace') {
                resolutionMethod = 'lazyClone';
                resolutionMethodElement = secondElement;
                resolutionMethodArgs = [];
            } else if (conflictResolutionStrategy === 'reverseReplace') {
                resolutionMethod = 'lazyClone';
                resolutionMethodElement = firstElement;
                resolutionMethodArgs = [];
            } else if (conflictResolutionStrategy === 'combine') {
                resolutionMethod = 'lazyCombine';
                resolutionMethodElement = firstElement;
                resolutionMethodArgs = [secondElement];
            } else if (conflictResolutionStrategy === 'reverseCombine') {
                resolutionMethod = 'lazyCombine';
                resolutionMethodElement = secondElement;
                resolutionMethodArgs = [firstElement];
            }
        } else {
            resolutionMethod = 'lazyClone';
            resolutionMethodElement = firstElement;
            resolutionMethodArgs = [];
        }

        // const lazyMethodName = 'lazy' + resolutionMethod[0].toUpperCase() + resolutionMethod.slice(1);
        const lazyMethodResult = resolutionMethodElement[resolutionMethod](...resolutionMethodArgs);

        conflict.element = lazyMethodResult[0];
        conflict.resolve = function() {
            lazyMethodResult[1].call(this.element);
        };

        return conflict;
    },

    asElement() {
        // pointerNode will return the pointedElement
        // doing ctrl+c & ctrl+v on a symlink on windows copy the symlinked file and not the symlink
        return this;
    },

    lazyClone() {
        const element = this;
        const clone = this.clone(false);

        return [
            clone,
            function() {
                this.cloneChildren(element, true);
            }
        ];
    },

    clone(deep = false) {
        const clone = this.createConstructor(this.value);

        clone.populate(this);
        if (deep) {
            clone.cloneChildren(this, true);
        }

        return clone;
    },

    populate(element) {
        // get all property except parentNode, children and copy them (we could also delete them afterwards)
        Object.keys(element).filter(function(name) {
            return ['parentNode', 'children'].includes(name) === false;
        }).forEach(function(name) {
            this[name] = element[name];
        }, this);
    },

    cloneChildren(element, deep = true) {
        for (let child of element) {
            this.appendChild(child.clone(deep));
        }
    },

    lazyCombine(secondElement) {
        const firstElement = this;
        const firstElementValue = firstElement.value;
        const secondElementValue = secondElement.value;
        const reducedValue = firstElement.reduce(firstElementValue, secondElementValue);
        const elementCombined = firstElement.createConstructor(reducedValue);
        elementCombined.populate(firstElement);
        // what if firstElement has .firstComponent & secondComponent property ?
        // no prob it will be overided but accessible doing elementCombined.firstComponent.firstComponent
        elementCombined.firstComponent = firstElement;
        elementCombined.secondComponent = secondElement;

        return [
            elementCombined,
            elementCombined.combine
        ];
    },

    reduce() {
        console.log(this, this.conflictResolutionStrategy);
        throw new Error('reduce method must be implemented');
    },

    combine() {
        // noop by default
    }
});
ObjectElement.refine({
    combine() {
        // ok le seul truc qui me dérange c'est que je clone deux fois dans le cas où
        // firstComponent à une prop name et secondComponent aussi et si la start c'est ignore
        // mais on s'en fous
        this.importChildren(this.firstComponent);
        this.importChildren(this.secondComponent);
    },

    importChildren(element) {
        for (let child of element) {
            this.importChild(child);
        }
    },

    importChild(element) {
        const elementToImport = element.asElement();
        const parentElement = this;
        const currentChild = parentElement.getChild(elementToImport);

        let child;
        if (currentChild) {
            let childConflict = currentChild.conflict(elementToImport);
            parentElement.replaceChild(currentChild, childConflict.element);
            childConflict.resolve();
        } else {
            let childConflict = elementToImport.conflict(); // we can omit conflictual element it means clone firstElement
            parentElement.appendChild(childConflict.element);
            childConflict.resolve();
        }

        return child;
    },

    getChild(property) {
        return this.getProperty(property.name);
    }
});
ObjectPropertyElement.refine({
    lazyCombine(secondObjectPropertyElement) {
        // hardcoded to a simpler version for now (only consider property as having one child being their value)
        const firstObjectPropertyElement = this;
        const firstPropertyValueNode = firstObjectPropertyElement.children[0];
        const secondPropertyValueNode = secondObjectPropertyElement.children[0];
        const combinedPropertyElement = this.clone(false);
        const combinedElementConflict = firstPropertyValueNode.conflict(secondPropertyValueNode);
        combinedPropertyElement.appendChild(combinedElementConflict.element);

        return [
            combinedPropertyElement,
            function() {
                combinedElementConflict.resolve();
            }
        ];

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
const isPropertyNameValidArrayIndex = (function() {
    const STRING = 0; // name is a string it cannot be an array index
    const INFINITE = 1; // name is casted to Infinity, NaN or -Infinity, it cannot be an array index
    const FLOATING = 2; // name is casted to a floating number, it cannot be an array index
    const NEGATIVE = 3; // name is casted to a negative integer, it cannot be an array index
    const TOO_BIG = 4; // name is casted to a integer above Math.pow(2, 32) - 1, it cannot be an array index
    const VALID = 5; // name is a valid array index
    const maxArrayIndexValue = Math.pow(2, 32) - 1;

    function getArrayIndexStatusForString(name) {
        if (isNaN(name)) {
            return STRING;
        }
        const number = Number(name);
        if (isFinite(number) === false) {
            return INFINITE;
        }
        if (Math.floor(number) !== number) {
            return FLOATING;
        }
        if (number < 0) {
            return NEGATIVE;
        }
        if (number > maxArrayIndexValue) {
            return TOO_BIG;
        }
        return VALID;
    }

    function isPropertyNameValidArrayIndex(propertyName) {
        return getArrayIndexStatusForString(propertyName) === VALID;
    }

    return isPropertyNameValidArrayIndex;
})();
ArrayObjectPropertyElement.refine({
    // note : JavaScript allow array & object to be combined, in the same fashion Array & Set may be combined as well
    // for now we ignore thoose exotic case
    isIndex() {
        return isPropertyNameValidArrayIndex(this.name);
    },

    lazyCombine(secondArrayObjectPropertyElement) {
        const isArrayConcatenationEnabledBySomething = true;
        const firstArrayObjectPropertyElement = this;

        if (isArrayConcatenationEnabledBySomething) {
            if (firstArrayObjectPropertyElement.name === 'length') {
                // we must force the firstArrayObjectPropertyElement.conflictResolutionStrategy to 'combine'
                // and firstArrayObjectPropertyElement.reduce return firstArrayLength + secondArrayLength
            } else if (firstArrayObjectPropertyElement.isIndex()) {
                const firstArray = firstArrayObjectPropertyElement.parentNode;
                const firstArrayLengthProperty = firstArray.getProperty('length');
                const firstArrayLength = firstArrayLengthProperty.children[0].value;
                const firstIndexedProperty = firstArrayObjectPropertyElement.clone(false);
                const secondIndexedProperty = secondArrayObjectPropertyElement.clone(false);
                const secondIndexedPropertyCurrentIndex = Number(secondArrayObjectPropertyElement.name);
                const secondIndexedPropertyFinalIndex = secondIndexedPropertyCurrentIndex + firstArrayLength;

                secondIndexedProperty.name = String(secondIndexedPropertyFinalIndex);

                // this is a special case where combine result in creating two element
                // for now it's handled using fragment that will insert their children when inserted
                const propertyFragment = Element.createFragment();
                propertyFragment.appendChild(firstIndexedProperty);
                propertyFragment.appendChild(secondIndexedProperty);

                return [
                    propertyFragment,
                    function() {
                        firstIndexedProperty.cloneChildren(firstArrayObjectPropertyElement, true);
                        secondIndexedProperty.cloneChildren(secondArrayObjectPropertyElement, true);
                    }
                ];
            }
        }
        return ObjectPropertyElement.call(this, secondArrayObjectPropertyElement);
    }
});

NullElement.refine({
    conflictResolutionStrategy: 'replace'
});
UndefinedElement.refine({
    conflictResolutionStrategy: 'replace'
});
BooleanElement.refine({
    conflictResolutionStrategy: 'replace'
});
NumberElement.refine({
    conflictResolutionStrategy: 'replace'
});
StringElement.refine({
    conflictResolutionStrategy: 'replace'
});
ObjectElement.refine({
    conflictResolutionStrategy: 'combine',
    reduce() {
        // combining two objects result into one object
        return {};
    }
});
// we may want to throw when two property are in conflict, but maybe it's more that we want to throw when two function are in conflict
// well it's hard to know for now when we want to throw for now we never throw we just resolve conflict by replace/combine
ObjectPropertyElement.refine({
    conflictResolutionStrategy: 'combine',
    reduce(firstPropertyName) {
        return firstPropertyName;
    }
});
FunctionObjectElement.refine({
    conflictResolutionStrategy: 'replace', // but we may allow 'combine' with the reduce method below
    reduce(firstFunction, secondFunction) {
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
    conflictResolutionStrategy: 'combine',
    combine() {
        // before importing the properties do we have something to do ? dont know
        ObjectElement.combine.call(this);
    },
    reduce() {
        // combining two array creates an array
        return [];
    }
});
// error may be composed together it has some meaning but for now keep it simple
ErrorObjectElement.refine({
    conflictResolutionStrategy: 'replace'
});
RegExpObjectElement.refine({
    conflictResolutionStrategy: 'replace'
});
DateObjectElement.refine({
    conflictResolutionStrategy: 'replace'
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
*/

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
