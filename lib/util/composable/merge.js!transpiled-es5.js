(function(__moduleName){System.register(['./util.js', './lab.js'], function (_export) {
    /* eslint-disable no-use-before-define, no-new-wrappers */

    // https://github.com/traitsjs/traits.js#composing-traits
    // we may want to throw when two property are in conflict, but maybe it's more that we want to throw when two function are in conflict
    // well it's hard to know for now when we want to throw for now we never throw we just resolve conflict by replace/combine
    // we may later decide to create some temp unstableComposition which are throw when compiled
    // and to provide some wau to make it stable by using replace(), combine() or other strategy to resolve the conflict
    // but for now keep as it is
    // note : JavaScript allow array & object to be combined, in the same fashion Array & Set may be combined as well
    // for now we ignore thoose exotic case
    'use strict';

    var util, Element, NullPrimitiveElement, UndefinedPrimitiveElement, BooleanPrimitiveElement, NumberPrimitiveElement, StringPrimitiveElement, ObjectElement, ObjectPropertyElement, ArrayElement, ArrayPropertyElement, FunctionElement, RegExpElement, StringElement, DateElement, ErrorElement, Transformation, Reaction, CopyTransformation, CopyObjectPropertyTransformation, CloneTransformation, ReplaceReaction, CombineObjectReaction, CloneObjectTransformation, CloneArrayTransformation, CombinePropertyReaction, PrevailReaction, CombineArrayReaction, createDynamicReaction, isPropertyNameValidArrayIndex, ArrayPropertyConcatTransformation;

    function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

    return {
        setters: [function (_utilJs) {
            util = _utilJs['default'];
        }, function (_labJs) {
            Element = _labJs.Element;
            NullPrimitiveElement = _labJs.NullPrimitiveElement;
            UndefinedPrimitiveElement = _labJs.UndefinedPrimitiveElement;
            BooleanPrimitiveElement = _labJs.BooleanPrimitiveElement;
            NumberPrimitiveElement = _labJs.NumberPrimitiveElement;
            StringPrimitiveElement = _labJs.StringPrimitiveElement;
            ObjectElement = _labJs.ObjectElement;
            ObjectPropertyElement = _labJs.ObjectPropertyElement;
            ArrayElement = _labJs.ArrayElement;
            ArrayPropertyElement = _labJs.ArrayPropertyElement;
            FunctionElement = _labJs.FunctionElement;
            RegExpElement = _labJs.RegExpElement;
            StringElement = _labJs.StringElement;
            DateElement = _labJs.DateElement;
            ErrorElement = _labJs.ErrorElement;
        }],
        execute: function () {

            Element.refine({
                compose: function compose(secondElement) {
                    var reaction = this.reactWith(secondElement);
                    var product = reaction.prepare();
                    reaction.proceed();
                    return product;
                },

                reactWith: function reactWith(secondElement, parentNode) {
                    var firstElement = this.asElement();
                    var reaction = firstElement.reaction;

                    return reaction.create(firstElement, secondElement, parentNode);
                },

                transform: function transform(parentNode) {
                    var transformation = this.transformation.create(this, parentNode);
                    return transformation;
                },

                asElement: function asElement() {
                    // pointerNode will return the pointedElement
                    // doing ctrl+c & ctrl+v on a symlink on windows copy the symlinked file and not the symlink
                    return this;
                }
            });

            // transformation of an element into an other
            Transformation = util.extend({
                constructor: function constructor() {
                    this.args = arguments;
                },

                prepare: function prepare() {
                    var product = this.produce.apply(this, _toConsumableArray(this.args));
                    this.product = product;
                    return product;
                },

                proceed: function proceed() {
                    var product = this.product;
                    this.refine.apply(this, [product].concat(_toConsumableArray(this.args)));
                    return product;
                }
            });

            // reaction is a transformation involving two elements
            Reaction = Transformation.extend();
            CopyTransformation = Transformation.extend({
                produce: function produce(element) {
                    var copy = element.createConstructor(element.value);
                    return copy;
                },

                refine: function refine(product, element) {
                    // must copy all children
                    var _iteratorNormalCompletion = true;
                    var _didIteratorError = false;
                    var _iteratorError = undefined;

                    try {
                        for (var _iterator = element[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                            var child = _step.value;

                            var childCopy = this.produce(child);
                            product.appendChild(childCopy);
                            this.refine(childCopy, child);
                        }
                    } catch (err) {
                        _didIteratorError = true;
                        _iteratorError = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion && _iterator['return']) {
                                _iterator['return']();
                            }
                        } finally {
                            if (_didIteratorError) {
                                throw _iteratorError;
                            }
                        }
                    }

                    return product;
                }
            });
            CopyObjectPropertyTransformation = CopyTransformation.extend();
            CloneTransformation = Transformation.extend({
                produce: function produce(element) {
                    var clonedValue = this.clone(element.value);
                    var clone = element.createConstructor(clonedValue);

                    return clone;
                },

                clone: function clone(value) {
                    // must be implemented: how to clone the value ?
                    return value;
                },

                refine: function refine(product, element) {
                    // must copy all children
                    var _iteratorNormalCompletion2 = true;
                    var _didIteratorError2 = false;
                    var _iteratorError2 = undefined;

                    try {
                        for (var _iterator2 = element[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                            var child = _step2.value;

                            var childClone = this.produce(child);
                            product.appendChild(childClone);
                            this.refine(childClone, child);
                        }
                    } catch (err) {
                        _didIteratorError2 = true;
                        _iteratorError2 = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion2 && _iterator2['return']) {
                                _iterator2['return']();
                            }
                        } finally {
                            if (_didIteratorError2) {
                                throw _iteratorError2;
                            }
                        }
                    }

                    return product;
                }
            });
            ReplaceReaction = Reaction.extend({
                constructor: function constructor(firstElement, secondElement) {
                    return CloneTransformation.create(secondElement);
                }
            });
            CombineObjectReaction = Reaction.extend({
                produce: function produce(firstElement, secondElement) {
                    var firstElementValue = firstElement.value;
                    var secondElementValue = secondElement.value;
                    var mergedValue = this.merge(firstElementValue, secondElementValue);
                    // console.log('the catalyst element name', Object.getPrototypeOf(catalystElement).name);
                    var mergedElement = firstElement.createConstructor(mergedValue);
                    // mergedElement.populate(firstElement);
                    // mergedElement.value = mergedValue;

                    // mergedElement.firstComponent = firstElement;
                    // mergedElement.secondComponent = secondElement;
                    // not needed we got the reaction property holding this information
                    // si firstElement et/ou secondElement sont le produit d'une réaction il faut garde cette info

                    return mergedElement;
                },

                merge: function merge() {
                    // combining two objects result into one object
                    return {};
                },

                refine: function refine(mergedObject, firstElement, secondElement) {
                    var _this = this;

                    var unhandledSecondProperties = secondElement.children.slice();
                    var _iteratorNormalCompletion3 = true;
                    var _didIteratorError3 = false;
                    var _iteratorError3 = undefined;

                    try {
                        var _loop = function () {
                            var property = _step3.value;

                            var secondPropertyIndex = unhandledSecondProperties.findIndex(function (secondProperty) {
                                return secondProperty.name === property.name;
                            });
                            if (secondPropertyIndex === -1) {
                                _this.handleNewProperty(mergedObject, property);
                                // console.log('add new property', property.value);
                            } else {
                                    // handle the conflict and remove this property from secondProperties
                                    var conflictualProperty = unhandledSecondProperties[secondPropertyIndex];
                                    unhandledSecondProperties.splice(secondPropertyIndex, 1);
                                    _this.handlePropertyCollision(mergedObject, property, conflictualProperty);
                                    // console.log('add conflictual property', property.value, conflictualProperty.value);
                                }
                        };

                        for (var _iterator3 = firstElement[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                            _loop();
                        }
                    } catch (err) {
                        _didIteratorError3 = true;
                        _iteratorError3 = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion3 && _iterator3['return']) {
                                _iterator3['return']();
                            }
                        } finally {
                            if (_didIteratorError3) {
                                throw _iteratorError3;
                            }
                        }
                    }

                    var _iteratorNormalCompletion4 = true;
                    var _didIteratorError4 = false;
                    var _iteratorError4 = undefined;

                    try {
                        for (var _iterator4 = unhandledSecondProperties[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                            var property = _step4.value;

                            this.handleNewProperty(mergedObject, property);
                            // console.log('add new second property', property.value);
                        }
                    } catch (err) {
                        _didIteratorError4 = true;
                        _iteratorError4 = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion4 && _iterator4['return']) {
                                _iterator4['return']();
                            }
                        } finally {
                            if (_didIteratorError4) {
                                throw _iteratorError4;
                            }
                        }
                    }
                },

                handlePropertyCollision: function handlePropertyCollision(element, property, conflictualProperty) {
                    // here we could impvoe perf by finding the appropriat reaction and if the reaction
                    // is to clone currentProperty we can do nothing because it's already there
                    var reaction = property.reactWith(conflictualProperty, element);
                    var importedProperty = reaction.prepare();
                    this.addProperty(element, importedProperty);
                    reaction.proceed();
                    return importedProperty;
                },

                handleNewProperty: function handleNewProperty(element, property) {
                    var transformation = property.transform(element);
                    var importedProperty = transformation.prepare();
                    this.addProperty(element, importedProperty);
                    transformation.proceed();
                    return importedProperty;
                },

                addProperty: function addProperty(element, property) {
                    element.appendChild(property);
                }
            });
            CloneObjectTransformation = CloneTransformation.extend({
                clone: function clone() {
                    return {};
                }
            });
            CloneArrayTransformation = CloneTransformation.extend({
                clone: function clone() {
                    return [];
                }
            });

            // const ReverseReplaceReaction = Reaction.extend({
            //     constructor(firstElement, secondElement) {
            //         return ReplaceReaction.create(secondElement, firstElement);
            //     }
            // });

            // const ReverseCombineObjectReaction = Reaction.extend({
            //     constructor(firstElement, secondElement) {
            //         return CombineObjectReaction.create(secondElement, firstElement);
            //     }
            // });

            CombinePropertyReaction = CombineObjectReaction.extend({
                merge: function merge(firstPropertyDescriptor, secondPropertyDescriptor) {
                    var combinedDescriptor = {};

                    Object.assign(combinedDescriptor, secondPropertyDescriptor);

                    return combinedDescriptor;
                },

                refine: function refine(combinedProperty, firstProperty, secondProperty) {
                    var firstDescriptor = firstProperty.descriptor;
                    var secondDescriptor = secondProperty.descriptor;

                    var situation = firstDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';
                    situation += '-';
                    situation += secondDescriptor.hasOwnProperty('value') ? 'value' : 'accessor';

                    // bah c'est cool mais aucun des deux n'est actuellement dans l'arbre, ils proviennent d'un autre arbre
                    if (situation === 'value-value') {
                        this.handleComponent(combinedProperty, 'valueNode', firstProperty, secondProperty);
                    } else if (situation === 'accessor-value') {
                        this.handleComponent(combinedProperty, 'valueNode', secondProperty);
                    } else if (situation === 'value-accessor') {
                        this.handleComponent(combinedProperty, 'getterNode', secondProperty);
                        this.handleComponent(combinedProperty, 'setterNode', secondProperty);
                    } else if (situation === 'accessor-accessor') {
                        this.handleComponent(combinedProperty, 'getterNode', firstProperty, secondProperty);
                        this.handleComponent(combinedProperty, 'setterNode', firstProperty, secondProperty);
                    }
                },

                handleComponent: function handleComponent(combinedProperty, componentName, firstProperty, secondProperty) {
                    var firstComponent = firstProperty[componentName];
                    var secondComponent = undefined;
                    if (firstComponent) {
                        if (secondProperty) {
                            secondComponent = secondProperty[componentName];
                        }

                        var reaction = undefined;
                        if (firstComponent && secondComponent) {
                            reaction = firstComponent.reactWith(secondComponent, combinedProperty);
                        } else if (firstComponent) {
                            reaction = firstComponent.transform(combinedProperty);
                        }

                        var reactionProduct = reaction.prepare();
                        combinedProperty[componentName] = reactionProduct;
                        reaction.proceed();
                    }
                }
            });
            PrevailReaction = Reaction.extend({
                produce: function produce(element) {
                    return element;
                },

                refine: function refine() {}
            });

            // we don't know yet the final array value we start from a container array
            // and we fill it one property after an other
            // once we're done we can freeze the array
            // we got the same approach in Lab.scan but we already have the final value
            // what we could do to be completely exaustive and prevent the freeze of an object
            // passed to compose it to alaways recreate a value no matter what (and I like this concept because more powerful)
            // it works for object/array, for error/function etc we will return the value unmodified because they are considered as primitive
            // but they will be frozen
            CombineArrayReaction = CombineObjectReaction.extend({
                merge: function merge() {
                    // combining two array creates an empty array
                    return [];
                },

                refine: function refine(mergedArray) {
                    var combinedLengthProperty = mergedArray.readProperty('length');
                    // in case of conflict this property must stay and it doesn't have to be cloned -> PrevailReaction
                    // because the combined array length will try to override this one
                    combinedLengthProperty.reaction = PrevailReaction;
                    return CombineObjectReaction.refine.apply(this, arguments);
                }
            });

            createDynamicReaction = function createDynamicReaction() {
                for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                    args[_key] = arguments[_key];
                }

                var reactions = args.filter(function (arg) {
                    return typeof arg !== 'function';
                });
                var matchers = args.filter(function (arg) {
                    return typeof arg === 'function';
                });

                return Reaction.extend({
                    constructor: function constructor() {
                        var _reaction;

                        for (var _len2 = arguments.length, reactionArgs = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                            reactionArgs[_key2] = arguments[_key2];
                        }

                        var matchIndex = matchers.findIndex(function (matcher) {
                            return matcher.apply(undefined, reactionArgs);
                        });

                        var reaction = undefined;
                        if (matchIndex === -1) {
                            reaction = reactions[reactions.length - 1];
                        } else {
                            reaction = reactions[matchIndex];
                        }

                        return (_reaction = reaction).create.apply(_reaction, reactionArgs);
                    }
                });
            };

            Element.refine({
                transformation: CopyTransformation
            });
            ObjectElement.refine({
                reaction: CombineObjectReaction,
                transformation: CloneObjectTransformation
            });
            ObjectPropertyElement.refine({
                reaction: CombinePropertyReaction,
                transformation: CopyObjectPropertyTransformation
            });
            ArrayElement.refine({
                reaction: CombineArrayReaction,
                transformation: CloneArrayTransformation
            });

            isPropertyNameValidArrayIndex = (function () {
                var STRING = 0; // name is a string it cannot be an array index
                var INFINITE = 1; // name is casted to Infinity, NaN or -Infinity, it cannot be an array index
                var FLOATING = 2; // name is casted to a floating number, it cannot be an array index
                var NEGATIVE = 3; // name is casted to a negative integer, it cannot be an array index
                var TOO_BIG = 4; // name is casted to a integer above Math.pow(2, 32) - 1, it cannot be an array index
                var VALID = 5; // name is a valid array index
                var maxArrayIndexValue = Math.pow(2, 32) - 1;

                function getArrayIndexStatusForString(name) {
                    if (isNaN(name)) {
                        return STRING;
                    }
                    var number = Number(name);
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

            ArrayPropertyConcatTransformation = CloneTransformation.extend({
                clone: function clone(arrayPropertyDescriptor) {
                    return Object.assign({}, arrayPropertyDescriptor);
                },

                prepare: function prepare() {
                    console.log('will call with', this.args);
                },

                produce: function produce(arrayProperty, array) {
                    // depending on some conf we may use CopyTransformation instead of cloneTransformation
                    // this would allow control if concat clone concatened entries or just concat them
                    var clone = CloneTransformation.produce.apply(this, arguments);

                    var arrayLengthProperty = array.getProperty('length');
                    var arrayLength = arrayLengthProperty.propertyValue;
                    var conflictualIndex = Number(arrayProperty.name);
                    var concatenedIndex = conflictualIndex + arrayLength;
                    var concatenedIndexAsString = String(concatenedIndex);

                    // now we copy the property
                    clone.name = concatenedIndexAsString;

                    return clone;
                }
            });

            ArrayPropertyElement.refine({
                isIndex: function isIndex() {
                    return isPropertyNameValidArrayIndex(this.name);
                },
                reaction: createDynamicReaction(function (arrayProperty) {
                    return arrayProperty.isIndex();
                }, CombinePropertyReaction.extend({
                    produce: function produce(firstArrayProperty, secondArrayProperty, array) {
                        var propertyDuo = Element.createFragment();
                        var firstPropertyTransformation = firstArrayProperty.transform(array);
                        var secondPropertyTransformation = ArrayPropertyConcatTransformation.create(secondArrayProperty, array);
                        var importedFirstProperty = firstPropertyTransformation.prepare();
                        var importedSecondProperty = secondPropertyTransformation.prepare();

                        propertyDuo.appendChild(importedFirstProperty);
                        propertyDuo.appendChild(importedSecondProperty);
                        propertyDuo.firstPropertyTransformation = firstPropertyTransformation;
                        propertyDuo.secondPropertyTransformation = secondPropertyTransformation;

                        return propertyDuo;
                    },

                    refine: function refine(propertyDuo) {
                        propertyDuo.firstPropertyTransformation.proceed();
                        propertyDuo.secondPropertyTransformation.proceed();
                    }
                }), CombinePropertyReaction)
            });
            NullPrimitiveElement.refine({
                reaction: ReplaceReaction
            });
            UndefinedPrimitiveElement.refine({
                reaction: ReplaceReaction
            });
            BooleanPrimitiveElement.refine({
                reaction: ReplaceReaction
            });
            NumberPrimitiveElement.refine({
                reaction: ReplaceReaction
            });
            StringPrimitiveElement.refine({
                reaction: ReplaceReaction
            });
            // ideally combining two string object would produce a string object with the primitive value of the second string
            // and properties of both string objects (just like CombineObject does)
            // for now this is disabled because if it would work for strings/date/regexp/number/boolean it would
            // - impact perf for Function
            // - would be hard to do new Error() and preserve the stack property
            // const CombineStringReaction = CombineObjectReaction.extend({
            //     merge(firstString, secondString) {
            //         return new String(secondString);
            //     }
            // });
            StringElement.refine({
                reaction: ReplaceReaction
            });
            FunctionElement.refine({
                reaction: ReplaceReaction
                // merge(firstFunction, secondFunction) {
                //     return function() {
                //         firstFunction.apply(this, arguments);
                //         return secondFunction.apply(this, arguments);
                //     };
                // }
                // transformSurroundedFragment(firstFunction, secondFunction, thirdFunction) {
                //     return function() {
                //         return secondFunction.call(this, firstFunction, thirdFunction, arguments, this);
                //     };
                // }
            });
            // error may be composed together it has some meaning but for now keep it simple
            ErrorElement.refine({
                reaction: ReplaceReaction
            });
            RegExpElement.refine({
                reaction: ReplaceReaction
            });
            DateElement.refine({
                reaction: ReplaceReaction
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
        }
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vQzovVXNlcnMvRGFtaWVuL0RvY3VtZW50cy9HaXRIdWIvanNlbnYvbGliL3V0aWwvY29tcG9zYWJsZS9tZXJnZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O3FTQTBETSxjQUFjLEVBbUJkLFFBQVEsRUFFUixrQkFBa0IsRUFrQmxCLGdDQUFnQyxFQUVoQyxtQkFBbUIsRUF3Qm5CLGVBQWUsRUFNZixxQkFBcUIsRUFzRXJCLHlCQUF5QixFQU16Qix3QkFBd0IsRUFrQnhCLHVCQUF1QixFQXFEdkIsZUFBZSxFQWtCZixvQkFBb0IsRUFlcEIscUJBQXFCLEVBeUNyQiw2QkFBNkIsRUFtQzdCLGlDQUFpQzs7Ozs7Ozs7NkJBcFhuQyxPQUFPOzBDQUNQLG9CQUFvQjsrQ0FDcEIseUJBQXlCOzZDQUN6Qix1QkFBdUI7NENBQ3ZCLHNCQUFzQjs0Q0FDdEIsc0JBQXNCO21DQUN0QixhQUFhOzJDQUNiLHFCQUFxQjtrQ0FDckIsWUFBWTswQ0FDWixvQkFBb0I7cUNBQ3BCLGVBQWU7bUNBQ2YsYUFBYTttQ0FDYixhQUFhO2lDQUNiLFdBQVc7a0NBQ1gsWUFBWTs7OztBQUdoQixtQkFBTyxDQUFDLE1BQU0sQ0FBQztBQUNYLHVCQUFPLEVBQUEsaUJBQUMsYUFBYSxFQUFFO0FBQ25CLHdCQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQy9DLHdCQUFNLE9BQU8sR0FBRyxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDbkMsNEJBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNuQiwyQkFBTyxPQUFPLENBQUM7aUJBQ2xCOztBQUVELHlCQUFTLEVBQUEsbUJBQUMsYUFBYSxFQUFFLFVBQVUsRUFBRTtBQUNqQyx3QkFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO0FBQ3RDLHdCQUFJLFFBQVEsR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDOztBQUVyQywyQkFBTyxR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QUNILGtDQUFzQixDQUFDLE1BQU0sQ0FBQztBQUMxQix3QkFBUSxFQUFFLGVBQWU7YUFDNUIsQ0FBQyxDQUFDO0FBQ0gsa0NBQXNCLENBQUMsTUFBTSxDQUFDO0FBQzFCLHdCQUFRLEVBQUUsZUFBZTthQUM1QixDQUFDLENBQUM7Ozs7Ozs7Ozs7O0FBV0gseUJBQWEsQ0FBQyxNQUFNLENBQUM7QUFDakIsd0JBQVEsRUFBRSxlQUFlO2FBQzVCLENBQUMsQ0FBQztBQUNILDJCQUFlLENBQUMsTUFBTSxDQUFDO0FBQ25CLHdCQUFRLEVBQUUsZUFBZTs7Ozs7Ozs7Ozs7O2FBWTVCLENBQUMsQ0FBQzs7QUFFSCx3QkFBWSxDQUFDLE1BQU0sQ0FBQztBQUNoQix3QkFBUSxFQUFFLGVBQWU7YUFDNUIsQ0FBQyxDQUFDO0FBQ0gseUJBQWEsQ0FBQyxNQUFNLENBQUM7QUFDakIsd0JBQVEsRUFBRSxlQUFlO2FBQzVCLENBQUMsQ0FBQztBQUNILHVCQUFXLENBQUMsTUFBTSxDQUFDO0FBQ2Ysd0JBQVEsRUFBRSxlQUFlO2FBQzVCLENBQUMsQ0FBQyIsImZpbGUiOiJmaWxlOi8vL0M6L1VzZXJzL0RhbWllbi9Eb2N1bWVudHMvR2l0SHViL2pzZW52L2xpYi91dGlsL2NvbXBvc2FibGUvbWVyZ2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBlc2xpbnQtZGlzYWJsZSBuby11c2UtYmVmb3JlLWRlZmluZSwgbm8tbmV3LXdyYXBwZXJzICovXHJcblxyXG4vLyBodHRwczovL2dpdGh1Yi5jb20vdHJhaXRzanMvdHJhaXRzLmpzI2NvbXBvc2luZy10cmFpdHNcclxuLy8gd2UgbWF5IHdhbnQgdG8gdGhyb3cgd2hlbiB0d28gcHJvcGVydHkgYXJlIGluIGNvbmZsaWN0LCBidXQgbWF5YmUgaXQncyBtb3JlIHRoYXQgd2Ugd2FudCB0byB0aHJvdyB3aGVuIHR3byBmdW5jdGlvbiBhcmUgaW4gY29uZmxpY3RcclxuLy8gd2VsbCBpdCdzIGhhcmQgdG8ga25vdyBmb3Igbm93IHdoZW4gd2Ugd2FudCB0byB0aHJvdyBmb3Igbm93IHdlIG5ldmVyIHRocm93IHdlIGp1c3QgcmVzb2x2ZSBjb25mbGljdCBieSByZXBsYWNlL2NvbWJpbmVcclxuLy8gd2UgbWF5IGxhdGVyIGRlY2lkZSB0byBjcmVhdGUgc29tZSB0ZW1wIHVuc3RhYmxlQ29tcG9zaXRpb24gd2hpY2ggYXJlIHRocm93IHdoZW4gY29tcGlsZWRcclxuLy8gYW5kIHRvIHByb3ZpZGUgc29tZSB3YXUgdG8gbWFrZSBpdCBzdGFibGUgYnkgdXNpbmcgcmVwbGFjZSgpLCBjb21iaW5lKCkgb3Igb3RoZXIgc3RyYXRlZ3kgdG8gcmVzb2x2ZSB0aGUgY29uZmxpY3RcclxuLy8gYnV0IGZvciBub3cga2VlcCBhcyBpdCBpc1xyXG4vLyBub3RlIDogSmF2YVNjcmlwdCBhbGxvdyBhcnJheSAmIG9iamVjdCB0byBiZSBjb21iaW5lZCwgaW4gdGhlIHNhbWUgZmFzaGlvbiBBcnJheSAmIFNldCBtYXkgYmUgY29tYmluZWQgYXMgd2VsbFxyXG4vLyBmb3Igbm93IHdlIGlnbm9yZSB0aG9vc2UgZXhvdGljIGNhc2VcclxuaW1wb3J0IHV0aWwgZnJvbSAnLi91dGlsLmpzJztcclxuXHJcbmltcG9ydCB7XHJcbiAgICBFbGVtZW50LFxyXG4gICAgTnVsbFByaW1pdGl2ZUVsZW1lbnQsXHJcbiAgICBVbmRlZmluZWRQcmltaXRpdmVFbGVtZW50LFxyXG4gICAgQm9vbGVhblByaW1pdGl2ZUVsZW1lbnQsXHJcbiAgICBOdW1iZXJQcmltaXRpdmVFbGVtZW50LFxyXG4gICAgU3RyaW5nUHJpbWl0aXZlRWxlbWVudCxcclxuICAgIE9iamVjdEVsZW1lbnQsXHJcbiAgICBPYmplY3RQcm9wZXJ0eUVsZW1lbnQsXHJcbiAgICBBcnJheUVsZW1lbnQsXHJcbiAgICBBcnJheVByb3BlcnR5RWxlbWVudCxcclxuICAgIEZ1bmN0aW9uRWxlbWVudCxcclxuICAgIFJlZ0V4cEVsZW1lbnQsXHJcbiAgICBTdHJpbmdFbGVtZW50LFxyXG4gICAgRGF0ZUVsZW1lbnQsXHJcbiAgICBFcnJvckVsZW1lbnRcclxufSBmcm9tICcuL2xhYi5qcyc7XHJcblxyXG5FbGVtZW50LnJlZmluZSh7XHJcbiAgICBjb21wb3NlKHNlY29uZEVsZW1lbnQpIHtcclxuICAgICAgICBjb25zdCByZWFjdGlvbiA9IHRoaXMucmVhY3RXaXRoKHNlY29uZEVsZW1lbnQpO1xyXG4gICAgICAgIGNvbnN0IHByb2R1Y3QgPSByZWFjdGlvbi5wcmVwYXJlKCk7XHJcbiAgICAgICAgcmVhY3Rpb24ucHJvY2VlZCgpO1xyXG4gICAgICAgIHJldHVybiBwcm9kdWN0O1xyXG4gICAgfSxcclxuXHJcbiAgICByZWFjdFdpdGgoc2Vjb25kRWxlbWVudCwgcGFyZW50Tm9kZSkge1xyXG4gICAgICAgIGNvbnN0IGZpcnN0RWxlbWVudCA9IHRoaXMuYXNFbGVtZW50KCk7XHJcbiAgICAgICAgbGV0IHJlYWN0aW9uID0gZmlyc3RFbGVtZW50LnJlYWN0aW9uO1xyXG5cclxuICAgICAgICByZXR1cm4gcmVhY3Rpb24uY3JlYXRlKGZpcnN0RWxlbWVudCwgc2Vjb25kRWxlbWVudCwgcGFyZW50Tm9kZSk7XHJcbiAgICB9LFxyXG5cclxuICAgIHRyYW5zZm9ybShwYXJlbnROb2RlKSB7XHJcbiAgICAgICAgY29uc3QgdHJhbnNmb3JtYXRpb24gPSB0aGlzLnRyYW5zZm9ybWF0aW9uLmNyZWF0ZSh0aGlzLCBwYXJlbnROb2RlKTtcclxuICAgICAgICByZXR1cm4gdHJhbnNmb3JtYXRpb247XHJcbiAgICB9LFxyXG5cclxuICAgIGFzRWxlbWVudCgpIHtcclxuICAgICAgICAvLyBwb2ludGVyTm9kZSB3aWxsIHJldHVybiB0aGUgcG9pbnRlZEVsZW1lbnRcclxuICAgICAgICAvLyBkb2luZyBjdHJsK2MgJiBjdHJsK3Ygb24gYSBzeW1saW5rIG9uIHdpbmRvd3MgY29weSB0aGUgc3ltbGlua2VkIGZpbGUgYW5kIG5vdCB0aGUgc3ltbGlua1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbi8vIHRyYW5zZm9ybWF0aW9uIG9mIGFuIGVsZW1lbnQgaW50byBhbiBvdGhlclxyXG5jb25zdCBUcmFuc2Zvcm1hdGlvbiA9IHV0aWwuZXh0ZW5kKHtcclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIHRoaXMuYXJncyA9IGFyZ3VtZW50cztcclxuICAgIH0sXHJcblxyXG4gICAgcHJlcGFyZSgpIHtcclxuICAgICAgICBjb25zdCBwcm9kdWN0ID0gdGhpcy5wcm9kdWNlKC4uLnRoaXMuYXJncyk7XHJcbiAgICAgICAgdGhpcy5wcm9kdWN0ID0gcHJvZHVjdDtcclxuICAgICAgICByZXR1cm4gcHJvZHVjdDtcclxuICAgIH0sXHJcblxyXG4gICAgcHJvY2VlZCgpIHtcclxuICAgICAgICBjb25zdCBwcm9kdWN0ID0gdGhpcy5wcm9kdWN0O1xyXG4gICAgICAgIHRoaXMucmVmaW5lKHByb2R1Y3QsIC4uLnRoaXMuYXJncyk7XHJcbiAgICAgICAgcmV0dXJuIHByb2R1Y3Q7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuLy8gcmVhY3Rpb24gaXMgYSB0cmFuc2Zvcm1hdGlvbiBpbnZvbHZpbmcgdHdvIGVsZW1lbnRzXHJcbmNvbnN0IFJlYWN0aW9uID0gVHJhbnNmb3JtYXRpb24uZXh0ZW5kKCk7XHJcblxyXG5jb25zdCBDb3B5VHJhbnNmb3JtYXRpb24gPSBUcmFuc2Zvcm1hdGlvbi5leHRlbmQoe1xyXG4gICAgcHJvZHVjZShlbGVtZW50KSB7XHJcbiAgICAgICAgY29uc3QgY29weSA9IGVsZW1lbnQuY3JlYXRlQ29uc3RydWN0b3IoZWxlbWVudC52YWx1ZSk7XHJcbiAgICAgICAgcmV0dXJuIGNvcHk7XHJcbiAgICB9LFxyXG5cclxuICAgIHJlZmluZShwcm9kdWN0LCBlbGVtZW50KSB7XHJcbiAgICAgICAgLy8gbXVzdCBjb3B5IGFsbCBjaGlsZHJlblxyXG4gICAgICAgIGZvciAobGV0IGNoaWxkIG9mIGVsZW1lbnQpIHtcclxuICAgICAgICAgICAgY29uc3QgY2hpbGRDb3B5ID0gdGhpcy5wcm9kdWNlKGNoaWxkKTtcclxuICAgICAgICAgICAgcHJvZHVjdC5hcHBlbmRDaGlsZChjaGlsZENvcHkpO1xyXG4gICAgICAgICAgICB0aGlzLnJlZmluZShjaGlsZENvcHksIGNoaWxkKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBwcm9kdWN0O1xyXG4gICAgfVxyXG59KTtcclxuXHJcbmNvbnN0IENvcHlPYmplY3RQcm9wZXJ0eVRyYW5zZm9ybWF0aW9uID0gQ29weVRyYW5zZm9ybWF0aW9uLmV4dGVuZCgpO1xyXG5cclxuY29uc3QgQ2xvbmVUcmFuc2Zvcm1hdGlvbiA9IFRyYW5zZm9ybWF0aW9uLmV4dGVuZCh7XHJcbiAgICBwcm9kdWNlKGVsZW1lbnQpIHtcclxuICAgICAgICBjb25zdCBjbG9uZWRWYWx1ZSA9IHRoaXMuY2xvbmUoZWxlbWVudC52YWx1ZSk7XHJcbiAgICAgICAgY29uc3QgY2xvbmUgPSBlbGVtZW50LmNyZWF0ZUNvbnN0cnVjdG9yKGNsb25lZFZhbHVlKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGNsb25lO1xyXG4gICAgfSxcclxuXHJcbiAgICBjbG9uZSh2YWx1ZSkge1xyXG4gICAgICAgIC8vIG11c3QgYmUgaW1wbGVtZW50ZWQ6IGhvdyB0byBjbG9uZSB0aGUgdmFsdWUgP1xyXG4gICAgICAgIHJldHVybiB2YWx1ZTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVmaW5lKHByb2R1Y3QsIGVsZW1lbnQpIHtcclxuICAgICAgICAvLyBtdXN0IGNvcHkgYWxsIGNoaWxkcmVuXHJcbiAgICAgICAgZm9yIChsZXQgY2hpbGQgb2YgZWxlbWVudCkge1xyXG4gICAgICAgICAgICBjb25zdCBjaGlsZENsb25lID0gdGhpcy5wcm9kdWNlKGNoaWxkKTtcclxuICAgICAgICAgICAgcHJvZHVjdC5hcHBlbmRDaGlsZChjaGlsZENsb25lKTtcclxuICAgICAgICAgICAgdGhpcy5yZWZpbmUoY2hpbGRDbG9uZSwgY2hpbGQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcHJvZHVjdDtcclxuICAgIH1cclxufSk7XHJcblxyXG5jb25zdCBSZXBsYWNlUmVhY3Rpb24gPSBSZWFjdGlvbi5leHRlbmQoe1xyXG4gICAgY29uc3RydWN0b3IoZmlyc3RFbGVtZW50LCBzZWNvbmRFbGVtZW50KSB7XHJcbiAgICAgICAgcmV0dXJuIENsb25lVHJhbnNmb3JtYXRpb24uY3JlYXRlKHNlY29uZEVsZW1lbnQpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbmNvbnN0IENvbWJpbmVPYmplY3RSZWFjdGlvbiA9IFJlYWN0aW9uLmV4dGVuZCh7XHJcbiAgICBwcm9kdWNlKGZpcnN0RWxlbWVudCwgc2Vjb25kRWxlbWVudCkge1xyXG4gICAgICAgIGNvbnN0IGZpcnN0RWxlbWVudFZhbHVlID0gZmlyc3RFbGVtZW50LnZhbHVlO1xyXG4gICAgICAgIGNvbnN0IHNlY29uZEVsZW1lbnRWYWx1ZSA9IHNlY29uZEVsZW1lbnQudmFsdWU7XHJcbiAgICAgICAgY29uc3QgbWVyZ2VkVmFsdWUgPSB0aGlzLm1lcmdlKGZpcnN0RWxlbWVudFZhbHVlLCBzZWNvbmRFbGVtZW50VmFsdWUpO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCd0aGUgY2F0YWx5c3QgZWxlbWVudCBuYW1lJywgT2JqZWN0LmdldFByb3RvdHlwZU9mKGNhdGFseXN0RWxlbWVudCkubmFtZSk7XHJcbiAgICAgICAgY29uc3QgbWVyZ2VkRWxlbWVudCA9IGZpcnN0RWxlbWVudC5jcmVhdGVDb25zdHJ1Y3RvcihtZXJnZWRWYWx1ZSk7XHJcbiAgICAgICAgLy8gbWVyZ2VkRWxlbWVudC5wb3B1bGF0ZShmaXJzdEVsZW1lbnQpO1xyXG4gICAgICAgIC8vIG1lcmdlZEVsZW1lbnQudmFsdWUgPSBtZXJnZWRWYWx1ZTtcclxuXHJcbiAgICAgICAgLy8gbWVyZ2VkRWxlbWVudC5maXJzdENvbXBvbmVudCA9IGZpcnN0RWxlbWVudDtcclxuICAgICAgICAvLyBtZXJnZWRFbGVtZW50LnNlY29uZENvbXBvbmVudCA9IHNlY29uZEVsZW1lbnQ7XHJcbiAgICAgICAgLy8gbm90IG5lZWRlZCB3ZSBnb3QgdGhlIHJlYWN0aW9uIHByb3BlcnR5IGhvbGRpbmcgdGhpcyBpbmZvcm1hdGlvblxyXG4gICAgICAgIC8vIHNpIGZpcnN0RWxlbWVudCBldC9vdSBzZWNvbmRFbGVtZW50IHNvbnQgbGUgcHJvZHVpdCBkJ3VuZSByw6lhY3Rpb24gaWwgZmF1dCBnYXJkZSBjZXR0ZSBpbmZvXHJcblxyXG4gICAgICAgIHJldHVybiBtZXJnZWRFbGVtZW50O1xyXG4gICAgfSxcclxuXHJcbiAgICBtZXJnZSgpIHtcclxuICAgICAgICAvLyBjb21iaW5pbmcgdHdvIG9iamVjdHMgcmVzdWx0IGludG8gb25lIG9iamVjdFxyXG4gICAgICAgIHJldHVybiB7fTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVmaW5lKG1lcmdlZE9iamVjdCwgZmlyc3RFbGVtZW50LCBzZWNvbmRFbGVtZW50KSB7XHJcbiAgICAgICAgY29uc3QgdW5oYW5kbGVkU2Vjb25kUHJvcGVydGllcyA9IHNlY29uZEVsZW1lbnQuY2hpbGRyZW4uc2xpY2UoKTtcclxuICAgICAgICBmb3IgKGxldCBwcm9wZXJ0eSBvZiBmaXJzdEVsZW1lbnQpIHtcclxuICAgICAgICAgICAgY29uc3Qgc2Vjb25kUHJvcGVydHlJbmRleCA9IHVuaGFuZGxlZFNlY29uZFByb3BlcnRpZXMuZmluZEluZGV4KGZ1bmN0aW9uKHNlY29uZFByb3BlcnR5KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gc2Vjb25kUHJvcGVydHkubmFtZSA9PT0gcHJvcGVydHkubmFtZTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmIChzZWNvbmRQcm9wZXJ0eUluZGV4ID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVOZXdQcm9wZXJ0eShtZXJnZWRPYmplY3QsIHByb3BlcnR5KTtcclxuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdhZGQgbmV3IHByb3BlcnR5JywgcHJvcGVydHkudmFsdWUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAvLyBoYW5kbGUgdGhlIGNvbmZsaWN0IGFuZCByZW1vdmUgdGhpcyBwcm9wZXJ0eSBmcm9tIHNlY29uZFByb3BlcnRpZXNcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZsaWN0dWFsUHJvcGVydHkgPSB1bmhhbmRsZWRTZWNvbmRQcm9wZXJ0aWVzW3NlY29uZFByb3BlcnR5SW5kZXhdO1xyXG4gICAgICAgICAgICAgICAgdW5oYW5kbGVkU2Vjb25kUHJvcGVydGllcy5zcGxpY2Uoc2Vjb25kUHJvcGVydHlJbmRleCwgMSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZVByb3BlcnR5Q29sbGlzaW9uKG1lcmdlZE9iamVjdCwgcHJvcGVydHksIGNvbmZsaWN0dWFsUHJvcGVydHkpO1xyXG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ2FkZCBjb25mbGljdHVhbCBwcm9wZXJ0eScsIHByb3BlcnR5LnZhbHVlLCBjb25mbGljdHVhbFByb3BlcnR5LnZhbHVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yIChsZXQgcHJvcGVydHkgb2YgdW5oYW5kbGVkU2Vjb25kUHJvcGVydGllcykge1xyXG4gICAgICAgICAgICB0aGlzLmhhbmRsZU5ld1Byb3BlcnR5KG1lcmdlZE9iamVjdCwgcHJvcGVydHkpO1xyXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnYWRkIG5ldyBzZWNvbmQgcHJvcGVydHknLCBwcm9wZXJ0eS52YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBoYW5kbGVQcm9wZXJ0eUNvbGxpc2lvbihlbGVtZW50LCBwcm9wZXJ0eSwgY29uZmxpY3R1YWxQcm9wZXJ0eSkge1xyXG4gICAgICAgIC8vIGhlcmUgd2UgY291bGQgaW1wdm9lIHBlcmYgYnkgZmluZGluZyB0aGUgYXBwcm9wcmlhdCByZWFjdGlvbiBhbmQgaWYgdGhlIHJlYWN0aW9uXHJcbiAgICAgICAgLy8gaXMgdG8gY2xvbmUgY3VycmVudFByb3BlcnR5IHdlIGNhbiBkbyBub3RoaW5nIGJlY2F1c2UgaXQncyBhbHJlYWR5IHRoZXJlXHJcbiAgICAgICAgY29uc3QgcmVhY3Rpb24gPSBwcm9wZXJ0eS5yZWFjdFdpdGgoY29uZmxpY3R1YWxQcm9wZXJ0eSwgZWxlbWVudCk7XHJcbiAgICAgICAgY29uc3QgaW1wb3J0ZWRQcm9wZXJ0eSA9IHJlYWN0aW9uLnByZXBhcmUoKTtcclxuICAgICAgICB0aGlzLmFkZFByb3BlcnR5KGVsZW1lbnQsIGltcG9ydGVkUHJvcGVydHkpO1xyXG4gICAgICAgIHJlYWN0aW9uLnByb2NlZWQoKTtcclxuICAgICAgICByZXR1cm4gaW1wb3J0ZWRQcm9wZXJ0eTtcclxuICAgIH0sXHJcblxyXG4gICAgaGFuZGxlTmV3UHJvcGVydHkoZWxlbWVudCwgcHJvcGVydHkpIHtcclxuICAgICAgICBjb25zdCB0cmFuc2Zvcm1hdGlvbiA9IHByb3BlcnR5LnRyYW5zZm9ybShlbGVtZW50KTtcclxuICAgICAgICBjb25zdCBpbXBvcnRlZFByb3BlcnR5ID0gdHJhbnNmb3JtYXRpb24ucHJlcGFyZSgpO1xyXG4gICAgICAgIHRoaXMuYWRkUHJvcGVydHkoZWxlbWVudCwgaW1wb3J0ZWRQcm9wZXJ0eSk7XHJcbiAgICAgICAgdHJhbnNmb3JtYXRpb24ucHJvY2VlZCgpO1xyXG4gICAgICAgIHJldHVybiBpbXBvcnRlZFByb3BlcnR5O1xyXG4gICAgfSxcclxuXHJcbiAgICBhZGRQcm9wZXJ0eShlbGVtZW50LCBwcm9wZXJ0eSkge1xyXG4gICAgICAgIGVsZW1lbnQuYXBwZW5kQ2hpbGQocHJvcGVydHkpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbmNvbnN0IENsb25lT2JqZWN0VHJhbnNmb3JtYXRpb24gPSBDbG9uZVRyYW5zZm9ybWF0aW9uLmV4dGVuZCh7XHJcbiAgICBjbG9uZSgpIHtcclxuICAgICAgICByZXR1cm4ge307XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuY29uc3QgQ2xvbmVBcnJheVRyYW5zZm9ybWF0aW9uID0gQ2xvbmVUcmFuc2Zvcm1hdGlvbi5leHRlbmQoe1xyXG4gICAgY2xvbmUoKSB7XHJcbiAgICAgICAgcmV0dXJuIFtdO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbi8vIGNvbnN0IFJldmVyc2VSZXBsYWNlUmVhY3Rpb24gPSBSZWFjdGlvbi5leHRlbmQoe1xyXG4vLyAgICAgY29uc3RydWN0b3IoZmlyc3RFbGVtZW50LCBzZWNvbmRFbGVtZW50KSB7XHJcbi8vICAgICAgICAgcmV0dXJuIFJlcGxhY2VSZWFjdGlvbi5jcmVhdGUoc2Vjb25kRWxlbWVudCwgZmlyc3RFbGVtZW50KTtcclxuLy8gICAgIH1cclxuLy8gfSk7XHJcblxyXG4vLyBjb25zdCBSZXZlcnNlQ29tYmluZU9iamVjdFJlYWN0aW9uID0gUmVhY3Rpb24uZXh0ZW5kKHtcclxuLy8gICAgIGNvbnN0cnVjdG9yKGZpcnN0RWxlbWVudCwgc2Vjb25kRWxlbWVudCkge1xyXG4vLyAgICAgICAgIHJldHVybiBDb21iaW5lT2JqZWN0UmVhY3Rpb24uY3JlYXRlKHNlY29uZEVsZW1lbnQsIGZpcnN0RWxlbWVudCk7XHJcbi8vICAgICB9XHJcbi8vIH0pO1xyXG5cclxuY29uc3QgQ29tYmluZVByb3BlcnR5UmVhY3Rpb24gPSBDb21iaW5lT2JqZWN0UmVhY3Rpb24uZXh0ZW5kKHtcclxuICAgIG1lcmdlKGZpcnN0UHJvcGVydHlEZXNjcmlwdG9yLCBzZWNvbmRQcm9wZXJ0eURlc2NyaXB0b3IpIHtcclxuICAgICAgICBjb25zdCBjb21iaW5lZERlc2NyaXB0b3IgPSB7fTtcclxuXHJcbiAgICAgICAgT2JqZWN0LmFzc2lnbihjb21iaW5lZERlc2NyaXB0b3IsIHNlY29uZFByb3BlcnR5RGVzY3JpcHRvcik7XHJcblxyXG4gICAgICAgIHJldHVybiBjb21iaW5lZERlc2NyaXB0b3I7XHJcbiAgICB9LFxyXG5cclxuICAgIHJlZmluZShjb21iaW5lZFByb3BlcnR5LCBmaXJzdFByb3BlcnR5LCBzZWNvbmRQcm9wZXJ0eSkge1xyXG4gICAgICAgIGNvbnN0IGZpcnN0RGVzY3JpcHRvciA9IGZpcnN0UHJvcGVydHkuZGVzY3JpcHRvcjtcclxuICAgICAgICBjb25zdCBzZWNvbmREZXNjcmlwdG9yID0gc2Vjb25kUHJvcGVydHkuZGVzY3JpcHRvcjtcclxuXHJcbiAgICAgICAgbGV0IHNpdHVhdGlvbiA9IGZpcnN0RGVzY3JpcHRvci5oYXNPd25Qcm9wZXJ0eSgndmFsdWUnKSA/ICd2YWx1ZScgOiAnYWNjZXNzb3InO1xyXG4gICAgICAgIHNpdHVhdGlvbiArPSAnLSc7XHJcbiAgICAgICAgc2l0dWF0aW9uICs9IHNlY29uZERlc2NyaXB0b3IuaGFzT3duUHJvcGVydHkoJ3ZhbHVlJykgPyAndmFsdWUnIDogJ2FjY2Vzc29yJztcclxuXHJcbiAgICAgICAgLy8gYmFoIGMnZXN0IGNvb2wgbWFpcyBhdWN1biBkZXMgZGV1eCBuJ2VzdCBhY3R1ZWxsZW1lbnQgZGFucyBsJ2FyYnJlLCBpbHMgcHJvdmllbm5lbnQgZCd1biBhdXRyZSBhcmJyZVxyXG4gICAgICAgIGlmIChzaXR1YXRpb24gPT09ICd2YWx1ZS12YWx1ZScpIHtcclxuICAgICAgICAgICAgdGhpcy5oYW5kbGVDb21wb25lbnQoY29tYmluZWRQcm9wZXJ0eSwgJ3ZhbHVlTm9kZScsIGZpcnN0UHJvcGVydHksIHNlY29uZFByb3BlcnR5KTtcclxuICAgICAgICB9IGVsc2UgaWYgKHNpdHVhdGlvbiA9PT0gJ2FjY2Vzc29yLXZhbHVlJykge1xyXG4gICAgICAgICAgICB0aGlzLmhhbmRsZUNvbXBvbmVudChjb21iaW5lZFByb3BlcnR5LCAndmFsdWVOb2RlJywgc2Vjb25kUHJvcGVydHkpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoc2l0dWF0aW9uID09PSAndmFsdWUtYWNjZXNzb3InKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlQ29tcG9uZW50KGNvbWJpbmVkUHJvcGVydHksICdnZXR0ZXJOb2RlJywgc2Vjb25kUHJvcGVydHkpO1xyXG4gICAgICAgICAgICB0aGlzLmhhbmRsZUNvbXBvbmVudChjb21iaW5lZFByb3BlcnR5LCAnc2V0dGVyTm9kZScsIHNlY29uZFByb3BlcnR5KTtcclxuICAgICAgICB9IGVsc2UgaWYgKHNpdHVhdGlvbiA9PT0gJ2FjY2Vzc29yLWFjY2Vzc29yJykge1xyXG4gICAgICAgICAgICB0aGlzLmhhbmRsZUNvbXBvbmVudChjb21iaW5lZFByb3BlcnR5LCAnZ2V0dGVyTm9kZScsIGZpcnN0UHJvcGVydHksIHNlY29uZFByb3BlcnR5KTtcclxuICAgICAgICAgICAgdGhpcy5oYW5kbGVDb21wb25lbnQoY29tYmluZWRQcm9wZXJ0eSwgJ3NldHRlck5vZGUnLCBmaXJzdFByb3BlcnR5LCBzZWNvbmRQcm9wZXJ0eSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBoYW5kbGVDb21wb25lbnQoY29tYmluZWRQcm9wZXJ0eSwgY29tcG9uZW50TmFtZSwgZmlyc3RQcm9wZXJ0eSwgc2Vjb25kUHJvcGVydHkpIHtcclxuICAgICAgICBjb25zdCBmaXJzdENvbXBvbmVudCA9IGZpcnN0UHJvcGVydHlbY29tcG9uZW50TmFtZV07XHJcbiAgICAgICAgbGV0IHNlY29uZENvbXBvbmVudDtcclxuICAgICAgICBpZiAoZmlyc3RDb21wb25lbnQpIHtcclxuICAgICAgICAgICAgaWYgKHNlY29uZFByb3BlcnR5KSB7XHJcbiAgICAgICAgICAgICAgICBzZWNvbmRDb21wb25lbnQgPSBzZWNvbmRQcm9wZXJ0eVtjb21wb25lbnROYW1lXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgbGV0IHJlYWN0aW9uO1xyXG4gICAgICAgICAgICBpZiAoZmlyc3RDb21wb25lbnQgJiYgc2Vjb25kQ29tcG9uZW50KSB7XHJcbiAgICAgICAgICAgICAgICByZWFjdGlvbiA9IGZpcnN0Q29tcG9uZW50LnJlYWN0V2l0aChzZWNvbmRDb21wb25lbnQsIGNvbWJpbmVkUHJvcGVydHkpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGZpcnN0Q29tcG9uZW50KSB7XHJcbiAgICAgICAgICAgICAgICByZWFjdGlvbiA9IGZpcnN0Q29tcG9uZW50LnRyYW5zZm9ybShjb21iaW5lZFByb3BlcnR5KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgcmVhY3Rpb25Qcm9kdWN0ID0gcmVhY3Rpb24ucHJlcGFyZSgpO1xyXG4gICAgICAgICAgICBjb21iaW5lZFByb3BlcnR5W2NvbXBvbmVudE5hbWVdID0gcmVhY3Rpb25Qcm9kdWN0O1xyXG4gICAgICAgICAgICByZWFjdGlvbi5wcm9jZWVkKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59KTtcclxuXHJcbmNvbnN0IFByZXZhaWxSZWFjdGlvbiA9IFJlYWN0aW9uLmV4dGVuZCh7XHJcbiAgICBwcm9kdWNlKGVsZW1lbnQpIHtcclxuICAgICAgICByZXR1cm4gZWxlbWVudDtcclxuICAgIH0sXHJcblxyXG4gICAgcmVmaW5lKCkge1xyXG5cclxuICAgIH1cclxufSk7XHJcblxyXG4vLyB3ZSBkb24ndCBrbm93IHlldCB0aGUgZmluYWwgYXJyYXkgdmFsdWUgd2Ugc3RhcnQgZnJvbSBhIGNvbnRhaW5lciBhcnJheVxyXG4vLyBhbmQgd2UgZmlsbCBpdCBvbmUgcHJvcGVydHkgYWZ0ZXIgYW4gb3RoZXJcclxuLy8gb25jZSB3ZSdyZSBkb25lIHdlIGNhbiBmcmVlemUgdGhlIGFycmF5XHJcbi8vIHdlIGdvdCB0aGUgc2FtZSBhcHByb2FjaCBpbiBMYWIuc2NhbiBidXQgd2UgYWxyZWFkeSBoYXZlIHRoZSBmaW5hbCB2YWx1ZVxyXG4vLyB3aGF0IHdlIGNvdWxkIGRvIHRvIGJlIGNvbXBsZXRlbHkgZXhhdXN0aXZlIGFuZCBwcmV2ZW50IHRoZSBmcmVlemUgb2YgYW4gb2JqZWN0XHJcbi8vIHBhc3NlZCB0byBjb21wb3NlIGl0IHRvIGFsYXdheXMgcmVjcmVhdGUgYSB2YWx1ZSBubyBtYXR0ZXIgd2hhdCAoYW5kIEkgbGlrZSB0aGlzIGNvbmNlcHQgYmVjYXVzZSBtb3JlIHBvd2VyZnVsKVxyXG4vLyBpdCB3b3JrcyBmb3Igb2JqZWN0L2FycmF5LCBmb3IgZXJyb3IvZnVuY3Rpb24gZXRjIHdlIHdpbGwgcmV0dXJuIHRoZSB2YWx1ZSB1bm1vZGlmaWVkIGJlY2F1c2UgdGhleSBhcmUgY29uc2lkZXJlZCBhcyBwcmltaXRpdmVcclxuLy8gYnV0IHRoZXkgd2lsbCBiZSBmcm96ZW5cclxuY29uc3QgQ29tYmluZUFycmF5UmVhY3Rpb24gPSBDb21iaW5lT2JqZWN0UmVhY3Rpb24uZXh0ZW5kKHtcclxuICAgIG1lcmdlKCkge1xyXG4gICAgICAgIC8vIGNvbWJpbmluZyB0d28gYXJyYXkgY3JlYXRlcyBhbiBlbXB0eSBhcnJheVxyXG4gICAgICAgIHJldHVybiBbXTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVmaW5lKG1lcmdlZEFycmF5KSB7XHJcbiAgICAgICAgY29uc3QgY29tYmluZWRMZW5ndGhQcm9wZXJ0eSA9IG1lcmdlZEFycmF5LnJlYWRQcm9wZXJ0eSgnbGVuZ3RoJyk7XHJcbiAgICAgICAgLy8gaW4gY2FzZSBvZiBjb25mbGljdCB0aGlzIHByb3BlcnR5IG11c3Qgc3RheSBhbmQgaXQgZG9lc24ndCBoYXZlIHRvIGJlIGNsb25lZCAtPiBQcmV2YWlsUmVhY3Rpb25cclxuICAgICAgICAvLyBiZWNhdXNlIHRoZSBjb21iaW5lZCBhcnJheSBsZW5ndGggd2lsbCB0cnkgdG8gb3ZlcnJpZGUgdGhpcyBvbmVcclxuICAgICAgICBjb21iaW5lZExlbmd0aFByb3BlcnR5LnJlYWN0aW9uID0gUHJldmFpbFJlYWN0aW9uO1xyXG4gICAgICAgIHJldHVybiBDb21iaW5lT2JqZWN0UmVhY3Rpb24ucmVmaW5lLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuY29uc3QgY3JlYXRlRHluYW1pY1JlYWN0aW9uID0gZnVuY3Rpb24oLi4uYXJncykge1xyXG4gICAgY29uc3QgcmVhY3Rpb25zID0gYXJncy5maWx0ZXIoZnVuY3Rpb24oYXJnKSB7XHJcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBhcmcgIT09ICdmdW5jdGlvbic7XHJcbiAgICB9KTtcclxuICAgIGNvbnN0IG1hdGNoZXJzID0gYXJncy5maWx0ZXIoZnVuY3Rpb24oYXJnKSB7XHJcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gUmVhY3Rpb24uZXh0ZW5kKHtcclxuICAgICAgICBjb25zdHJ1Y3RvciguLi5yZWFjdGlvbkFyZ3MpIHtcclxuICAgICAgICAgICAgY29uc3QgbWF0Y2hJbmRleCA9IG1hdGNoZXJzLmZpbmRJbmRleChmdW5jdGlvbihtYXRjaGVyKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbWF0Y2hlciguLi5yZWFjdGlvbkFyZ3MpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGxldCByZWFjdGlvbjtcclxuICAgICAgICAgICAgaWYgKG1hdGNoSW5kZXggPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICByZWFjdGlvbiA9IHJlYWN0aW9uc1tyZWFjdGlvbnMubGVuZ3RoIC0gMV07XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZWFjdGlvbiA9IHJlYWN0aW9uc1ttYXRjaEluZGV4XTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHJlYWN0aW9uLmNyZWF0ZSguLi5yZWFjdGlvbkFyZ3MpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59O1xyXG5cclxuRWxlbWVudC5yZWZpbmUoe1xyXG4gICAgdHJhbnNmb3JtYXRpb246IENvcHlUcmFuc2Zvcm1hdGlvblxyXG59KTtcclxuT2JqZWN0RWxlbWVudC5yZWZpbmUoe1xyXG4gICAgcmVhY3Rpb246IENvbWJpbmVPYmplY3RSZWFjdGlvbixcclxuICAgIHRyYW5zZm9ybWF0aW9uOiBDbG9uZU9iamVjdFRyYW5zZm9ybWF0aW9uXHJcbn0pO1xyXG5PYmplY3RQcm9wZXJ0eUVsZW1lbnQucmVmaW5lKHtcclxuICAgIHJlYWN0aW9uOiBDb21iaW5lUHJvcGVydHlSZWFjdGlvbixcclxuICAgIHRyYW5zZm9ybWF0aW9uOiBDb3B5T2JqZWN0UHJvcGVydHlUcmFuc2Zvcm1hdGlvblxyXG59KTtcclxuQXJyYXlFbGVtZW50LnJlZmluZSh7XHJcbiAgICByZWFjdGlvbjogQ29tYmluZUFycmF5UmVhY3Rpb24sXHJcbiAgICB0cmFuc2Zvcm1hdGlvbjogQ2xvbmVBcnJheVRyYW5zZm9ybWF0aW9uXHJcbn0pO1xyXG5jb25zdCBpc1Byb3BlcnR5TmFtZVZhbGlkQXJyYXlJbmRleCA9IChmdW5jdGlvbigpIHtcclxuICAgIGNvbnN0IFNUUklORyA9IDA7IC8vIG5hbWUgaXMgYSBzdHJpbmcgaXQgY2Fubm90IGJlIGFuIGFycmF5IGluZGV4XHJcbiAgICBjb25zdCBJTkZJTklURSA9IDE7IC8vIG5hbWUgaXMgY2FzdGVkIHRvIEluZmluaXR5LCBOYU4gb3IgLUluZmluaXR5LCBpdCBjYW5ub3QgYmUgYW4gYXJyYXkgaW5kZXhcclxuICAgIGNvbnN0IEZMT0FUSU5HID0gMjsgLy8gbmFtZSBpcyBjYXN0ZWQgdG8gYSBmbG9hdGluZyBudW1iZXIsIGl0IGNhbm5vdCBiZSBhbiBhcnJheSBpbmRleFxyXG4gICAgY29uc3QgTkVHQVRJVkUgPSAzOyAvLyBuYW1lIGlzIGNhc3RlZCB0byBhIG5lZ2F0aXZlIGludGVnZXIsIGl0IGNhbm5vdCBiZSBhbiBhcnJheSBpbmRleFxyXG4gICAgY29uc3QgVE9PX0JJRyA9IDQ7IC8vIG5hbWUgaXMgY2FzdGVkIHRvIGEgaW50ZWdlciBhYm92ZSBNYXRoLnBvdygyLCAzMikgLSAxLCBpdCBjYW5ub3QgYmUgYW4gYXJyYXkgaW5kZXhcclxuICAgIGNvbnN0IFZBTElEID0gNTsgLy8gbmFtZSBpcyBhIHZhbGlkIGFycmF5IGluZGV4XHJcbiAgICBjb25zdCBtYXhBcnJheUluZGV4VmFsdWUgPSBNYXRoLnBvdygyLCAzMikgLSAxO1xyXG5cclxuICAgIGZ1bmN0aW9uIGdldEFycmF5SW5kZXhTdGF0dXNGb3JTdHJpbmcobmFtZSkge1xyXG4gICAgICAgIGlmIChpc05hTihuYW1lKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gU1RSSU5HO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBudW1iZXIgPSBOdW1iZXIobmFtZSk7XHJcbiAgICAgICAgaWYgKGlzRmluaXRlKG51bWJlcikgPT09IGZhbHNlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBJTkZJTklURTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKE1hdGguZmxvb3IobnVtYmVyKSAhPT0gbnVtYmVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBGTE9BVElORztcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKG51bWJlciA8IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuIE5FR0FUSVZFO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobnVtYmVyID4gbWF4QXJyYXlJbmRleFZhbHVlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBUT09fQklHO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gVkFMSUQ7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNQcm9wZXJ0eU5hbWVWYWxpZEFycmF5SW5kZXgocHJvcGVydHlOYW1lKSB7XHJcbiAgICAgICAgcmV0dXJuIGdldEFycmF5SW5kZXhTdGF0dXNGb3JTdHJpbmcocHJvcGVydHlOYW1lKSA9PT0gVkFMSUQ7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGlzUHJvcGVydHlOYW1lVmFsaWRBcnJheUluZGV4O1xyXG59KSgpO1xyXG5jb25zdCBBcnJheVByb3BlcnR5Q29uY2F0VHJhbnNmb3JtYXRpb24gPSBDbG9uZVRyYW5zZm9ybWF0aW9uLmV4dGVuZCh7XHJcbiAgICBjbG9uZShhcnJheVByb3BlcnR5RGVzY3JpcHRvcikge1xyXG4gICAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBhcnJheVByb3BlcnR5RGVzY3JpcHRvcik7XHJcbiAgICB9LFxyXG5cclxuICAgIHByZXBhcmUoKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ3dpbGwgY2FsbCB3aXRoJywgdGhpcy5hcmdzKTtcclxuICAgIH0sXHJcblxyXG4gICAgcHJvZHVjZShhcnJheVByb3BlcnR5LCBhcnJheSkge1xyXG4gICAgICAgIC8vIGRlcGVuZGluZyBvbiBzb21lIGNvbmYgd2UgbWF5IHVzZSBDb3B5VHJhbnNmb3JtYXRpb24gaW5zdGVhZCBvZiBjbG9uZVRyYW5zZm9ybWF0aW9uXHJcbiAgICAgICAgLy8gdGhpcyB3b3VsZCBhbGxvdyBjb250cm9sIGlmIGNvbmNhdCBjbG9uZSBjb25jYXRlbmVkIGVudHJpZXMgb3IganVzdCBjb25jYXQgdGhlbVxyXG4gICAgICAgIGNvbnN0IGNsb25lID0gQ2xvbmVUcmFuc2Zvcm1hdGlvbi5wcm9kdWNlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcblxyXG4gICAgICAgIGNvbnN0IGFycmF5TGVuZ3RoUHJvcGVydHkgPSBhcnJheS5nZXRQcm9wZXJ0eSgnbGVuZ3RoJyk7XHJcbiAgICAgICAgY29uc3QgYXJyYXlMZW5ndGggPSBhcnJheUxlbmd0aFByb3BlcnR5LnByb3BlcnR5VmFsdWU7XHJcbiAgICAgICAgY29uc3QgY29uZmxpY3R1YWxJbmRleCA9IE51bWJlcihhcnJheVByb3BlcnR5Lm5hbWUpO1xyXG4gICAgICAgIGNvbnN0IGNvbmNhdGVuZWRJbmRleCA9IGNvbmZsaWN0dWFsSW5kZXggKyBhcnJheUxlbmd0aDtcclxuICAgICAgICBjb25zdCBjb25jYXRlbmVkSW5kZXhBc1N0cmluZyA9IFN0cmluZyhjb25jYXRlbmVkSW5kZXgpO1xyXG5cclxuICAgICAgICAvLyBub3cgd2UgY29weSB0aGUgcHJvcGVydHlcclxuICAgICAgICBjbG9uZS5uYW1lID0gY29uY2F0ZW5lZEluZGV4QXNTdHJpbmc7XHJcblxyXG4gICAgICAgIHJldHVybiBjbG9uZTtcclxuICAgIH1cclxufSk7XHJcbkFycmF5UHJvcGVydHlFbGVtZW50LnJlZmluZSh7XHJcbiAgICBpc0luZGV4KCkge1xyXG4gICAgICAgIHJldHVybiBpc1Byb3BlcnR5TmFtZVZhbGlkQXJyYXlJbmRleCh0aGlzLm5hbWUpO1xyXG4gICAgfSxcclxuICAgIHJlYWN0aW9uOiBjcmVhdGVEeW5hbWljUmVhY3Rpb24oXHJcbiAgICAgICAgZnVuY3Rpb24oYXJyYXlQcm9wZXJ0eSkge1xyXG4gICAgICAgICAgICByZXR1cm4gYXJyYXlQcm9wZXJ0eS5pc0luZGV4KCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBDb21iaW5lUHJvcGVydHlSZWFjdGlvbi5leHRlbmQoe1xyXG4gICAgICAgICAgICBwcm9kdWNlKGZpcnN0QXJyYXlQcm9wZXJ0eSwgc2Vjb25kQXJyYXlQcm9wZXJ0eSwgYXJyYXkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5RHVvID0gRWxlbWVudC5jcmVhdGVGcmFnbWVudCgpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZmlyc3RQcm9wZXJ0eVRyYW5zZm9ybWF0aW9uID0gZmlyc3RBcnJheVByb3BlcnR5LnRyYW5zZm9ybShhcnJheSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzZWNvbmRQcm9wZXJ0eVRyYW5zZm9ybWF0aW9uID0gQXJyYXlQcm9wZXJ0eUNvbmNhdFRyYW5zZm9ybWF0aW9uLmNyZWF0ZShcclxuICAgICAgICAgICAgICAgICAgICBzZWNvbmRBcnJheVByb3BlcnR5LFxyXG4gICAgICAgICAgICAgICAgICAgIGFycmF5XHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaW1wb3J0ZWRGaXJzdFByb3BlcnR5ID0gZmlyc3RQcm9wZXJ0eVRyYW5zZm9ybWF0aW9uLnByZXBhcmUoKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGltcG9ydGVkU2Vjb25kUHJvcGVydHkgPSBzZWNvbmRQcm9wZXJ0eVRyYW5zZm9ybWF0aW9uLnByZXBhcmUoKTtcclxuXHJcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eUR1by5hcHBlbmRDaGlsZChpbXBvcnRlZEZpcnN0UHJvcGVydHkpO1xyXG4gICAgICAgICAgICAgICAgcHJvcGVydHlEdW8uYXBwZW5kQ2hpbGQoaW1wb3J0ZWRTZWNvbmRQcm9wZXJ0eSk7XHJcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eUR1by5maXJzdFByb3BlcnR5VHJhbnNmb3JtYXRpb24gPSBmaXJzdFByb3BlcnR5VHJhbnNmb3JtYXRpb247XHJcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eUR1by5zZWNvbmRQcm9wZXJ0eVRyYW5zZm9ybWF0aW9uID0gc2Vjb25kUHJvcGVydHlUcmFuc2Zvcm1hdGlvbjtcclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJvcGVydHlEdW87XHJcbiAgICAgICAgICAgIH0sXHJcblxyXG4gICAgICAgICAgICByZWZpbmUocHJvcGVydHlEdW8pIHtcclxuICAgICAgICAgICAgICAgIHByb3BlcnR5RHVvLmZpcnN0UHJvcGVydHlUcmFuc2Zvcm1hdGlvbi5wcm9jZWVkKCk7XHJcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eUR1by5zZWNvbmRQcm9wZXJ0eVRyYW5zZm9ybWF0aW9uLnByb2NlZWQoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIENvbWJpbmVQcm9wZXJ0eVJlYWN0aW9uXHJcbiAgICApXHJcbn0pO1xyXG5OdWxsUHJpbWl0aXZlRWxlbWVudC5yZWZpbmUoe1xyXG4gICAgcmVhY3Rpb246IFJlcGxhY2VSZWFjdGlvblxyXG59KTtcclxuVW5kZWZpbmVkUHJpbWl0aXZlRWxlbWVudC5yZWZpbmUoe1xyXG4gICAgcmVhY3Rpb246IFJlcGxhY2VSZWFjdGlvblxyXG59KTtcclxuQm9vbGVhblByaW1pdGl2ZUVsZW1lbnQucmVmaW5lKHtcclxuICAgIHJlYWN0aW9uOiBSZXBsYWNlUmVhY3Rpb25cclxufSk7XHJcbk51bWJlclByaW1pdGl2ZUVsZW1lbnQucmVmaW5lKHtcclxuICAgIHJlYWN0aW9uOiBSZXBsYWNlUmVhY3Rpb25cclxufSk7XHJcblN0cmluZ1ByaW1pdGl2ZUVsZW1lbnQucmVmaW5lKHtcclxuICAgIHJlYWN0aW9uOiBSZXBsYWNlUmVhY3Rpb25cclxufSk7XHJcbi8vIGlkZWFsbHkgY29tYmluaW5nIHR3byBzdHJpbmcgb2JqZWN0IHdvdWxkIHByb2R1Y2UgYSBzdHJpbmcgb2JqZWN0IHdpdGggdGhlIHByaW1pdGl2ZSB2YWx1ZSBvZiB0aGUgc2Vjb25kIHN0cmluZ1xyXG4vLyBhbmQgcHJvcGVydGllcyBvZiBib3RoIHN0cmluZyBvYmplY3RzIChqdXN0IGxpa2UgQ29tYmluZU9iamVjdCBkb2VzKVxyXG4vLyBmb3Igbm93IHRoaXMgaXMgZGlzYWJsZWQgYmVjYXVzZSBpZiBpdCB3b3VsZCB3b3JrIGZvciBzdHJpbmdzL2RhdGUvcmVnZXhwL251bWJlci9ib29sZWFuIGl0IHdvdWxkXHJcbi8vIC0gaW1wYWN0IHBlcmYgZm9yIEZ1bmN0aW9uXHJcbi8vIC0gd291bGQgYmUgaGFyZCB0byBkbyBuZXcgRXJyb3IoKSBhbmQgcHJlc2VydmUgdGhlIHN0YWNrIHByb3BlcnR5XHJcbi8vIGNvbnN0IENvbWJpbmVTdHJpbmdSZWFjdGlvbiA9IENvbWJpbmVPYmplY3RSZWFjdGlvbi5leHRlbmQoe1xyXG4vLyAgICAgbWVyZ2UoZmlyc3RTdHJpbmcsIHNlY29uZFN0cmluZykge1xyXG4vLyAgICAgICAgIHJldHVybiBuZXcgU3RyaW5nKHNlY29uZFN0cmluZyk7XHJcbi8vICAgICB9XHJcbi8vIH0pO1xyXG5TdHJpbmdFbGVtZW50LnJlZmluZSh7XHJcbiAgICByZWFjdGlvbjogUmVwbGFjZVJlYWN0aW9uXHJcbn0pO1xyXG5GdW5jdGlvbkVsZW1lbnQucmVmaW5lKHtcclxuICAgIHJlYWN0aW9uOiBSZXBsYWNlUmVhY3Rpb25cclxuICAgIC8vIG1lcmdlKGZpcnN0RnVuY3Rpb24sIHNlY29uZEZ1bmN0aW9uKSB7XHJcbiAgICAvLyAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xyXG4gICAgLy8gICAgICAgICBmaXJzdEZ1bmN0aW9uLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICAvLyAgICAgICAgIHJldHVybiBzZWNvbmRGdW5jdGlvbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgLy8gICAgIH07XHJcbiAgICAvLyB9XHJcbiAgICAvLyB0cmFuc2Zvcm1TdXJyb3VuZGVkRnJhZ21lbnQoZmlyc3RGdW5jdGlvbiwgc2Vjb25kRnVuY3Rpb24sIHRoaXJkRnVuY3Rpb24pIHtcclxuICAgIC8vICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XHJcbiAgICAvLyAgICAgICAgIHJldHVybiBzZWNvbmRGdW5jdGlvbi5jYWxsKHRoaXMsIGZpcnN0RnVuY3Rpb24sIHRoaXJkRnVuY3Rpb24sIGFyZ3VtZW50cywgdGhpcyk7XHJcbiAgICAvLyAgICAgfTtcclxuICAgIC8vIH1cclxufSk7XHJcbi8vIGVycm9yIG1heSBiZSBjb21wb3NlZCB0b2dldGhlciBpdCBoYXMgc29tZSBtZWFuaW5nIGJ1dCBmb3Igbm93IGtlZXAgaXQgc2ltcGxlXHJcbkVycm9yRWxlbWVudC5yZWZpbmUoe1xyXG4gICAgcmVhY3Rpb246IFJlcGxhY2VSZWFjdGlvblxyXG59KTtcclxuUmVnRXhwRWxlbWVudC5yZWZpbmUoe1xyXG4gICAgcmVhY3Rpb246IFJlcGxhY2VSZWFjdGlvblxyXG59KTtcclxuRGF0ZUVsZW1lbnQucmVmaW5lKHtcclxuICAgIHJlYWN0aW9uOiBSZXBsYWNlUmVhY3Rpb25cclxufSk7XHJcblxyXG4vKlxyXG5FbGVtZW50LnJlZmluZSh7XHJcbiAgICAvLyByZXNvbHZlKG1lcmdlQ29uZmxpY3RSZXNvbHZlcikge1xyXG4gICAgLy8gICAgIGNvbnN0IHJlc29sdmVkRWxlbWVudCA9IHRoaXMuY2xvbmUoKTtcclxuICAgIC8vICAgICByZXNvbHZlZEVsZW1lbnQucmVzb2x2ZXIgPSBtZXJnZUNvbmZsaWN0UmVzb2x2ZXI7XHJcbiAgICAvLyAgICAgbWVyZ2VDb25mbGljdFJlc29sdmVyLnJlc29sdmVOb3codGhpcyk7XHJcbiAgICAvLyAgICAgcmV0dXJuIHJlc29sdmVkRWxlbWVudDtcclxuICAgIC8vIH0sXHJcblxyXG4gICAgLy8gY3JlYXRlRnJhZ21lbnQoKSB7XHJcbiAgICAvLyAgICAgY29uc3QgZnJhZ21lbnQgPSB0aGlzLmNyZWF0ZUNvbnN0cnVjdG9yKCk7XHJcbiAgICAvLyAgICAgZnJhZ21lbnQuY29tcGlsZSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgLy8gICAgICAgICBjb25zdCBjaGlsZHJlbkNvbXBpbGVSZXN1bHQgPSB0aGlzLmNoaWxkcmVuLm1hcChmdW5jdGlvbihjaGlsZCkge1xyXG4gICAgLy8gICAgICAgICAgICAgcmV0dXJuIGNoaWxkLmNvbXBpbGUoKTtcclxuICAgIC8vICAgICAgICAgfSk7XHJcblxyXG4gICAgLy8gICAgICAgICBpZiAoY2hpbGRyZW5Db21waWxlUmVzdWx0Lmxlbmd0aCA9PT0gMikge1xyXG4gICAgLy8gICAgICAgICAgICAgcmV0dXJuIHRoaXMudHJhbnNmb3JtQ29tYmluZWRGcmFnbWVudCguLi5jaGlsZHJlbkNvbXBpbGVSZXN1bHQpO1xyXG4gICAgLy8gICAgICAgICB9XHJcbiAgICAvLyAgICAgICAgIHJldHVybiB0aGlzLnRyYW5zZm9ybVN1cnJvdW5kZWRGcmFnbWVudCguLi5jaGlsZHJlbkNvbXBpbGVSZXN1bHQpO1xyXG4gICAgLy8gICAgIH07XHJcbiAgICAvLyAgICAgcmV0dXJuIGZyYWdtZW50O1xyXG4gICAgLy8gfSxcclxuXHJcbiAgICAvLyB0cmFuc2Zvcm1GcmFnbWVudCgpIHtcclxuICAgIC8vICAgICB0aHJvdyBuZXcgRXJyb3IoJ3VuaW1wbGVtZW50ZWQgdHJhbnNmb3JtRnJhZ21lbnQnKTtcclxuICAgIC8vIH0sXHJcblxyXG4gICAgLy8gcHJlcGVuZChlbGVtZW50KSB7XHJcbiAgICAvLyAgICAgY29uc3QgZnJhZ21lbnQgPSB0aGlzLmNyZWF0ZUZyYWdtZW50KCk7XHJcbiAgICAvLyAgICAgdGhpcy5yZXBsYWNlKGZyYWdtZW50KTtcclxuICAgIC8vICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChlbGVtZW50LmNsb25lKCkpO1xyXG4gICAgLy8gICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHRoaXMpO1xyXG4gICAgLy8gICAgIHJldHVybiBmcmFnbWVudDtcclxuICAgIC8vIH0sXHJcblxyXG4gICAgLy8gYXBwZW5kKGVsZW1lbnQpIHtcclxuICAgIC8vICAgICBjb25zdCBmcmFnbWVudCA9IHRoaXMuY3JlYXRlRnJhZ21lbnQoKTtcclxuICAgIC8vICAgICB0aGlzLnJlcGxhY2UoZnJhZ21lbnQpO1xyXG4gICAgLy8gICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHRoaXMpO1xyXG4gICAgLy8gICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGVsZW1lbnQuY2xvbmUoKSk7XHJcbiAgICAvLyAgICAgcmV0dXJuIGZyYWdtZW50O1xyXG4gICAgLy8gfSxcclxuXHJcbiAgICAvLyBzdXJyb3VuZChwcmV2aW91c0VsZW1lbnQsIG5leHRFbGVtZW50KSB7XHJcbiAgICAvLyAgICAgY29uc3QgZnJhZ21lbnQgPSB0aGlzLmNyZWF0ZUZyYWdtZW50KCk7XHJcbiAgICAvLyAgICAgdGhpcy5yZXBsYWNlKGZyYWdtZW50KTtcclxuICAgIC8vICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChwcmV2aW91c0VsZW1lbnQuY2xvbmUoKSk7XHJcbiAgICAvLyAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodGhpcyk7XHJcbiAgICAvLyAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQobmV4dEVsZW1lbnQuY2xvbmUoKSk7XHJcbiAgICAvLyAgICAgcmV0dXJuIGZyYWdtZW50O1xyXG4gICAgLy8gfVxyXG59KTtcclxuKi9cclxuXHJcbi8qXHJcbi8vIEkgc3VwcG9zZSBudWxsLCB1bmRlZmluZWQsIHRydWUvZmFsc2UsIG1heSBub3QgYmUgY29tYmluZWRcclxuLy8gaG93ZXZlciBvYmplY3QgbWF5IGJlIGNvbWJpbmVkIGluIHRoZSBzYW1lIGZhc2hpb24gaW5zdGVhZCBvZiB1c2luZyBtZXJnZVByb3BlcnRpZXMgd2UgY291bGRcclxuLy8gY3JlYXRlIG9iamVjdEZyYWdtZW50IChieSBkZWZhdWx0IG1lcmdlUHJvcGVydGllcyB3b3VsZCBtZWFuIGFwcGVuZClcclxuLy8gcHJlcGVuZCB3b3VsZCBhbGxvdyBhIGdyZWF0IGZlYXR1cmUgd2hpY2ggaXMgdG8gcHV0IG1lcmdlZCBvYmplY3QgcHJvcGVydGllcyBmaXJzdFxyXG5cclxuZG9uYyBjJ2VzdCBzdXBlciBtYWlzIGplIHZvaXMgdW4gcHJvYmzDqG1lOlxyXG5cclxub2JqZWN0QS5tZXJnZShvYmplY3RCKVxyXG5vayBvbiBjcsOpZXIgdW5lIHNvcnRlIGQnb2JqZWN0IGNvbXBvc2l0ZSBkdSBnZW5yZVxyXG5vYmplY3RDID0gW29iamVjdEEsIG9iamVjdEJdXHJcbnBhciBjb250cmUgYydlc3QgcmVsb3UgcGFyY2UgcXUnb24gaWdub3JlIGNvbXBsw6h0ZW1lbnQgc2kgbGVzIHByb3ByacOpdMOpcyB2b250IGNvbGxpc2lvbmVyXHJcbmNlbGEgcG91cnJhaXQgc2UgZmFpcmUgw6AgbGEgY29tcGlsYXRpb24gbWFpcyBlc3QtY2UgY29ycmVjdCBkZSB2b2lyIGxlcyBjaG9zZXMgY29tbWUgw6dhIGplIG5lIHNhaXMgcGFzXHJcbnNpIGplIGNyw6llIHVuZSB2ZXJzaW9uIGNvbWJpbsOpIGRlcyBkZXV4IG9iamV0cyBqZSBwZXJkIGRhdGEgb3UgYWxvcnMgYXUgbW9tZW50IGRlIGNyw6llciBsZSBvYmplY3QgZnJhZ21lbnRcclxub24gYXVyYSBlZmZlY3RpdmVtZW50IG9iamVjdEZyYWdtZW50ID0gW29iamVjdEEsIG9iamVjdEJdXHJcbm9rIG5vbiBlbiBmYWl0IHZvaWzDoCBjZSBxdSdpbCBzZSBwYXNzZSA6IG9uIG1lcmdlIGRpcmVjdFxyXG5vYmplY3RBIGV0IG9iamVjdEIgZGlzcGFyYWl0IGF1IHByb2ZpdCBkZSBvYmplY3RDIHF1aSBlc3QgdW4gb2JqZWN0IHV0aWxpc2FudCBsZXMgcHJvcHJpw6l0w6kgZGUgQSBldCBCIG1lcmfDqVxyXG5jYXMgcGFydGljdWxpZXI6XHJcbm9iamVjdEEuc2VsZiA9IG9iamVjdEEsIG9iamVjdEIubWUgPSBvYmplY3RCXHJcbmFsb3JzIG9iamVjdEMuc2VsZiA9PT0gb2JqZWN0QyAmIG9iamVjdEMubWUgPT09IG9iamVjdENcclxuXHJcbm3Dqm1lIGZ1bmN0aW9uIGV0IHN0cmluZyBkZXZyYWl0IGZhaXJlIMOnYSA6IGRldmVuaXIgdW5lIHNldWxlIGVudGl0w6kgaW1tw6lkaWF0ZW1tZW50IGV0IHBhcyDDoCBsYSBjb21waWxhdGlvblxyXG5jb21waWxlIG5lIGZlcmFzIHF1ZSByZXRvdXJuZXIgbGEgZm9uY3Rpb24gY21vcG9zw6kgb3UgdW4gY2xvbmUgZGUgbGEgZm9uY3Rpb24gY29tcG9zw6lcclxucGFyZWlsIHBvdXIgbGVzIG9iamV0OiBjcsOpZXIgdW4gY2xvbmUgZGUgbCdvYmpldCBjb21wb3PDqVxyXG5sZSBzZXVsIHRydWMgcXUnaWwgZmF1ZHJhaXQgZ2FyZGUgYydlc3QgcXVlIHNpIG9uIHZldXQgc2VyaWFsaXplIGxhIGZvbmN0aW9uIGNvcnJlc3BvbmRhbnRlIGlsIGZhdXQgY29ubmFpdHJlXHJcbmxlcyBmb25jdGlvbiBxdWkgY29tcG9zZSBsYSBmb25jdGlvbiBmaW5hbGUsIHNpIG9uIGNvbXBvc2UgZXQgcXUnb24gcGVyZCBjZXR0ZSBpbmZvIG9uIG5lIHBldXQgcGx1cyBzZXJpYWxpemVcclxuaWwgZmF1ZHJhaXMgcGV1dCDDqnRyZSBjb25zZXJ2ZXIgcXVlbHF1ZSBjaG9zZSBjb21tZSBsYSBzb3VyY2UgZGUgbGEgZm9uY3Rpb24gY29tbWUgdW5lIHByb3ByacOpdMOpIGRlIGxhZGl0ZSBmb25jdGlvbiBkZSBzb3J0ZVxyXG5xdSdvbiBwZXV0IGNvbWJpbmVyIGNldHRlIHByb3ByacOpdMOpIHBvdXIgbGEgdmVyc2lvbiBjb21wb3PDqSA/IG91IHF1ZWxxdWUgY2hvc2UgY29tbWUgw6dhIChldCBsYSBjb21iaW5hdGlvbiBkZXMgc291cmNlcyByw6lzdWx0ZXJhaXQgZW4gdW4gdGFibGVhdSlcclxuZGUgcGx1cyBsZXMgcsOpZsOpcmVuY2VzIHZlcnMgbGVzIG9iamVjdCBub24gY29tYmluw6kgZGV2cmFpdCB0b3V0ZXMgcG9pbnRlciB2ZXJzIGxlcyBvYmpldHMgY29tYmluw6kgZXN0IGNlIHNldWxlbWVudCBwb3NzaWJsZVxyXG5cclxuaWwgZmF1ZHJhaXMgYWN0aXZlciBvdSBub24gcHJlcGVuZC9hcHBlbmQvc3Vycm91bmQgZW4gZm9uY3Rpb24gZGUgY2hhcXVlIGVsZW1lbnRcclxuY2VydGFpbiBzdXBwb3J0ZSBhdWN1bmUsIHVuZSBwYXJ0aWUgb3UgdG91dGVzIGNlcyBtw6l0aG9kZXNcclxuKi9cclxuXHJcbi8vIHdvdWxkIGFsc28gaW1hZ2luZSBhIHJlc29sdmVyIHdoaWNoIGFkZHMgbnVtYmVyLCBtdWx0aXBseSB0aGVtLCBkaXZpZGUgdGhlbSBldGNcclxuLy8gdGhlIGFtb3VudCBvZiBwb3NzaWJsZSByZXNvbHZlciBpcyBpbmZpbml0ZSBhbmQgd2UgbXVzdCBwcm92aWRlIGFuIGFwaVxyXG4vLyBhbGxvd2luZyB0byB1c2UgZGlmZmVyZW50IHJlc29sdmVyIGRlcGVuZGluZyBvbiB0aGUgZWxlbWVudCBBTkQgdGhlIGNvbmZsaWN0dWFsRWxlbWVudCAoYW5kIG5vdCBhIHJlc29sdmVyIHBlciBlbGVtZW50IGlnbm9yaW5nIHRoZSBjb25mbGljdHVhbCBvbmUpXHJcbi8qXHJcbi0gcmVzb2x2ZXIgbWF5IHNheSBoZXkgSSdtIHdvcmtpbmcgd2l0aCBhIGZpcnN0IGFyZ3VtZW50IHdoaWNoIGlzIGEgZnVuY3Rpb24gYW5kIGEgc2Vjb25kIGlzIGEgc3RyaW5nXHJcbnRvIG1ha2UgaXQgc2ltcGxlIGlmIGEgcmVzb2x2ZXIgaGFzIG1hbnkgc2lnbmF0dXJlIGl0IG11c3QgYmUgZXhwcmVzc2VkIGJ5IHBvbHltb3JwaGlzbVxyXG5cclxub24gYSBhdXNzaSBiZXNvaW4gZW5zdWl0ZSBkZSBwb3V2b2lyIGRpcmUgdm9pY2kgbGEgbGlzdGUgZGVzIHLDqXNvbHZldXJzIGFzc29jacOpIMOgIGNldCDDqWxlbWVudFxyXG5kb25jIGVuIGdyb3MgbGUgcHJlbWllciByZXNvbHZlciBxdWkgbWF0Y2ggb24gbCd1dGlsaXNlXHJcblxyXG4vLyBvbiBwb3VycmFpdCBhdm9pciB1bmUgc29ydGUgZGUgbWVyZ2UgY29uZmxpY3QgcmVzb2x1dGlvbiBjb25maWcgcGFyIMOpbGVtZW50IHF1aSBkaXRcclxuLy8gcG91ciBtb2kgbcOqbWUgZXQgbWVzIGRlc2NlbmRhbnRzIHZvaWNpIGxhIGNvbmZpZyBlbiBjYXMgZGUgbWVyZ2UgY29uZmxpY3RcclxuLy8gZXQgY2hhcXVlIGVsZW1lbnQgZGVzY2VuZGFudCBwZXV0IG92ZXJyaWRlIGNldHRlIGNvbmZpZyBldCBlbiBow6lyaXRlIHBhciBkw6lmYXV0IChnZW5yZSBDU1MpXHJcbi8vIHNhdWYgcXVlIGNldHRlIGluZm8gZGV2cmFpdCDDqnRyZSBtaXNlIHN1ciBFbGVtZW50IHB1aXNxdWUgdG91cyBsZXMgc291cyDDqWzDqW1lbnRzIGVuIGjDqXJpdGVcclxubWFpcyBjZSBuJ2VzdCBhY3R1ZWxsZW1lbnQgcGFzIHBvc3NpYmxlIGRlIHJlZMOpZmluaXIgw6dhIHF1YW5kIG9uIHZldXQgb3UgYWxvcnMgZmF1ZHJhaXMgRWxlbWVudC5jb25maWdcclxucXVpIHBvdXJyYWlzIMOqdHJlIG92ZXJyaWRlIHBhciBTdHJpbmcuY29uZmlnIG92ZXJyaWRlIGVsbGUtbcOqbWUgcGFyIHN0cmluZy5jb25maWdcclxuaWdub3JvbnMgY2UgcHJvYmzDqG1lIHBvdXIgbGUgbW9tZW50IHF1aSBlc3QgYmllbiBhdmFuY8OpIGV0IG1ldHRvbnMgZW4gcGxhY2UgY29tbWUgc2kgYyfDqXRhaXQgYm9uIHN1ciBFbGVtZW50LmNvbmZpZ1xyXG4qL1xyXG5cclxuLy8gZnVuY3Rpb24gY29tcG9zZUZ1bmN0aW9uKGZpcnN0RnVuY3Rpb24sIHNlY29uZEZ1bmN0aW9uLCBjb21wb3NpdGlvbkhhbmRsZXIpIHtcclxuLy8gICAgIGxldCBmdW5jdGlvbkZyYWdtZW50O1xyXG5cclxuLy8gICAgIGlmIChjb21wb3NpdGlvbkhhbmRsZXIpIHtcclxuLy8gICAgICAgICBjb25zdCBzdXJyb3VuZGVkRWxlbWVudCA9IEZ1bmN0aW9uT2JqZWN0RWxlbWVudC5jcmVhdGUoKS53cml0ZShjb21wb3NpdGlvbkhhbmRsZXIpO1xyXG4vLyAgICAgICAgIGZ1bmN0aW9uRnJhZ21lbnQgPSBzdXJyb3VuZGVkRWxlbWVudC5zdXJyb3VuZChmaXJzdEZ1bmN0aW9uLCBzZWNvbmRGdW5jdGlvbik7XHJcbi8vICAgICB9IGVsc2Uge1xyXG4vLyAgICAgICAgIGZ1bmN0aW9uRnJhZ21lbnQgPSBmaXJzdEZ1bmN0aW9uLmFwcGVuZChzZWNvbmRGdW5jdGlvbik7XHJcbi8vICAgICB9XHJcblxyXG4vLyAgICAgcmV0dXJuIGZ1bmN0aW9uRnJhZ21lbnQ7XHJcbi8vIH1cclxuXHJcbi8vIHJlbmFtZSBtdXN0IGJlIGF2YWlsYWJsZSBvbmx5IGZvciBvYmplY3RQcm9wZXJ0eUVsZW1lbnRcclxuLy8gUmVzb2x2ZXJTdG9yZS5yZWdpc3RlcigncmVuYW1lJywge1xyXG4vLyAgICAgY29uc3RydWN0b3IocmVuYW1lV2l0aCkge1xyXG4vLyAgICAgICAgIHRoaXMucmVuYW1lV2l0aCA9IHJlbmFtZVdpdGg7XHJcbi8vICAgICB9LFxyXG4gICAgLy8gZWxlbWVudE1hdGNoZXI6ICdhbnknXHJcbiAgICAvLyBuZSBwYXMgdXRpbGlzZXIgcmVzb2x2ZU5vdyBtYWludGVuYW50IHknYSBxdWUgdW4gcmVzb2x2ZUxhdGVyIHF1aSBwZXV0IMOqdHJlIGR5bmFtaXF1ZVxyXG4gICAgLy8gcmVzb2x2ZU5vdyhlbGVtZW50LCBwcm9wZXJ0aWVzLCBjb25mbGljdFJlc29sdmVyTWFwKSB7XHJcbiAgICAvLyAgICAgbGV0IHJlc29sdmVkUHJvcGVydHk7XHJcbiAgICAvLyAgICAgY29uc3QgcmVuYW1lV2l0aCA9IHRoaXMucmVuYW1lV2l0aDtcclxuXHJcbiAgICAvLyAgICAgLy8gcHJvcGVydHkubmFtZSA9IHJlbmFtZVdpdGg7XHJcbiAgICAvLyAgICAgLy8gY2hlY2sgaWYgcmVuYW1lIGNyZWF0ZXMgYW4gaW50ZXJuYWwgY29uZmxpY3RcclxuICAgIC8vICAgICBjb25zdCBjb25mbGljdHVhbFByb3BlcnR5ID0gcHJvcGVydGllcy5nZXQocmVuYW1lV2l0aCk7XHJcblxyXG4gICAgLy8gICAgIGlmIChjb25mbGljdHVhbFByb3BlcnR5KSB7XHJcbiAgICAvLyAgICAgICAgIHZhciBtZXNzYWdlID0gJ2NvbmZsaWN0IG11c3Qgbm90IGJlIGhhbmRsZWQgYnkgcmVuYW1pbmcgXCInICsgcHJvcGVydHkubmFtZSArICdcIiAtPiBcIicgKyByZW5hbWVXaXRoO1xyXG4gICAgLy8gICAgICAgICBtZXNzYWdlICs9ICdcIiBiZWNhdXNlIGl0IGFscmVhZHkgZXhpc3RzJztcclxuICAgIC8vICAgICAgICAgbGV0IGVycm9yID0gcHJvcGVydHkuY3JlYXRlQ29uZmxpY3RFcnJvcihcclxuICAgIC8vICAgICAgICAgICAgIGNvbmZsaWN0dWFsUHJvcGVydHksXHJcbiAgICAvLyAgICAgICAgICAgICBtZXNzYWdlLFxyXG4gICAgLy8gICAgICAgICAgICAgJ3Jlc29sdmUoe3JlbmFtZTogXFwnJyArIHJlbmFtZVdpdGggKyAnLWZyZWVcXCd9KSdcclxuICAgIC8vICAgICAgICAgKTtcclxuICAgIC8vICAgICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICAvLyAgICAgfSBlbHNlIHtcclxuICAgIC8vICAgICAgICAgY29uc3QgcmVuYW1lZFByb3BlcnR5ID0gcHJvcGVydHkucmVuYW1lKHJlbmFtZVdpdGgpO1xyXG4gICAgLy8gICAgICAgICByZXNvbHZlZFByb3BlcnR5ID0gcHJvcGVydGllcy5yZXNvbHZlUHJvcGVydHkocmVuYW1lZFByb3BlcnR5LCBjb25mbGljdFJlc29sdmVyTWFwKTtcclxuICAgIC8vICAgICB9XHJcblxyXG4gICAgLy8gICAgIHJldHVybiByZXNvbHZlZFByb3BlcnR5O1xyXG4gICAgLy8gfVxyXG4vLyB9KTtcclxuIl19
})("file:///C:/Users/Damien/Documents/GitHub/jsenv/lib/util/composable/merge.js");
//# sourceURL=file:///C:/Users/Damien/Documents/GitHub/jsenv/lib/util/composable/merge.js!transpiled