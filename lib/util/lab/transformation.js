/* eslint-disable no-use-before-define, no-new-wrappers */

// https://github.com/traitsjs/traits.js#composing-traits
// we may want to throw when two property are in conflict, but maybe it's more that we want to throw when two function are in conflict
// well it's hard to know for now when we want to throw for now we never throw we just resolve conflict by replace/combine
// we may later decide to create some temp unstableComposition which are throw when compiled
// and to provide some wau to make it stable by using replace(), combine() or other strategy to resolve the conflict
// but for now keep as it is
// note : JavaScript allow array & object to be combined, in the same fashion Array & Set may be combined as well
// for now we ignore thoose exotic case

import util from './util.js';

// transformation of an element into an other
const Transformation = util.extend({
    constructor() {
        this.args = arguments;
    },

    prepare() {
        const product = this.produce(...this.args);
        this.product = product;
        return product;
    },

    insert() {
        const parentElement = this.args[1];
        const element = this.args[0];
        if (parentElement) {
            if (element.parentNode === parentElement) {
                parentElement.replaceChild(element, this.product);
            } else {
                parentElement.appendChild(this.product);
            }
        }
    },

    proceed() {
        const product = this.product;
        this.refine(product, ...this.args);
        if (product) {
            product.effect(...this.args);
        }
        return product;
    }
});

// reaction is a transformation involving two elements
const Reaction = Transformation.extend({
    insert() {
        const parentElement = this.args[2];
        const element = this.args[0];
        if (parentElement) {
            if (element.parentNode === parentElement) {
                parentElement.replaceChild(element, this.product);
            } else {
                parentElement.appendChild(this.product);
            }
        }
    }
});

const NoReaction = Transformation.extend({
    produce() {},
    insert() {},
    refine() {}
});

const CopyTransformation = Transformation.extend({
    produce(element) {
        const copy = element.copy();
        // console.log('copying', element, 'got', copy);
        return copy;
    },

    refine(copyOfElement, element) {
        for (let constituent of element) {
            const constituentTransformation = CopyTransformation.create(constituent, copyOfElement);
            constituentTransformation.prepare();
            constituentTransformation.insert();
            constituentTransformation.proceed();
        }
    }
});
const CloneTransformation = Transformation.extend({
    produce(element) {
        const clone = element.clone();
        return clone;
    },

    refine(cloneOfElement, element) {
        for (let constituent of element) {
            const constituentTransformation = CloneTransformation.create(constituent, cloneOfElement);
            constituentTransformation.prepare();
            constituentTransformation.insert();
            constituentTransformation.proceed();
        }
    }
});
const ReplaceReaction = Reaction.extend({
    constructor(firstElement, secondElement) {
        // shouldn't we consider replace as using copy and not clone ?
        return CopyTransformation.create(secondElement);
    }
});
const ReverseReplaceReaction = Reaction.extend({
    constructor(firstElement, secondElement) {
        return ReplaceReaction.create(secondElement, firstElement);
    }
});
const PrevailReaction = Reaction.extend({
    produce(element) {
        return element;
    },

    refine() {

    }
});
const createDynamicReaction = function(...args) {
    const matchers = args.filter(function(arg) {
        return typeof arg === 'function';
    });
    const reactions = args.filter(function(arg) {
        return typeof arg !== 'function';
    });

    return Reaction.extend({
        constructor(...reactionArgs) {
            const matchIndex = matchers.findIndex(function(matcher) {
                return matcher(...reactionArgs);
            });

            let reaction;
            if (matchIndex === -1) {
                reaction = reactions[reactions.length - 1];
            } else {
                reaction = reactions[matchIndex];
            }

            return reaction.create(...reactionArgs);
        }
    });
};

const createDynamicTransformation = function(...args) {
    const matchers = args.filter(function(arg) {
        return typeof arg === 'function';
    });
    const transformations = args.filter(function(arg) {
        return typeof arg !== 'function';
    });

    return Transformation.extend({
        constructor(...transformationArgs) {
            const matchIndex = matchers.findIndex(function(matcher) {
                return matcher(...transformationArgs);
            });

            let transformation;
            if (matchIndex === -1) {
                transformation = transformations[transformations.length - 1];
            } else {
                transformation = transformations[matchIndex];
            }

            return transformation.create(...transformationArgs);
        }
    });
};

export {
    Transformation,
    CopyTransformation,
    CloneTransformation,
    createDynamicTransformation,
    Reaction,
    NoReaction,
    ReplaceReaction,
    ReverseReplaceReaction,
    PrevailReaction,
    createDynamicReaction
};

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
