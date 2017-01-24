jsenv.build(function registerStandardFeatures() {
        registerStandard('asap').expect(
            presence,
            function calledBeforeSetTimeout(resolve, reject) {
                var asap = this.value;
                var setTimeoutCalledBeforeAsap = false;
                setTimeout(function() {
                    setTimeoutCalledBeforeAsap = true;
                }, 1);
                asap(function() {
                    if (setTimeoutCalledBeforeAsap) {
                        reject();
                    } else {
                        resolve();
                    }
                });
            }
        );

        registerSyntax('const').expect(
            presence,
            {
                name: 'scoped-for-of',
                dependencies: ['for-of'],
                test: function() {
                    return true;
                }
            }
        );

        registerStandardFeatures('global',
            {name: 'asap', spec: 'es7'},
            {name: 'map', type: 'constructor'},
            {name: 'observable', type: 'constructor', spec: 'es7'},
            {
                name: 'parse-int',
                valid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/_parse-int.js
                    var ws = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003';
                    ws += '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

                    return (
                        parseInt(ws + '08') === 8 &&
                        parseInt(ws + '0x16') === 22
                    );
                }
            },
            {
                name: 'parse-float',
                valid: function() {
                    var ws = '\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003';
                    ws += '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/_parse-float.js
                    return 1 / parseFloat(ws + '-0') === -Infinity;
                }
            },
            {
                name: 'promise',
                type: 'constructor',
                valid: function() {
                    // agent must implement onunhandledrejection to consider promise implementation valid
                    if (jsenv.isBrowser()) {
                        if ('onunhandledrejection' in jsenv.global) {
                            return true;
                        }
                        return false;
                    }
                    if (jsenv.isNode()) {
                        // node version > 0.12.0 got the unhandledRejection hook
                        // this way to detect feature is AWFUL but for now let's do this
                        if (jsenv.agent.version.major > 0 || jsenv.agent.version.minor > 12) {
                            // apprently node 6.1.0 unhandledRejection is not great too, to be tested
                            if (jsenv.agent.version.major === 6 && jsenv.agent.version.minor === 1) {
                                return false;
                            }
                            return true;
                        }
                        return false;
                    }
                    return false;
                }
            },
            {name: 'set', type: 'constructor'},
            {name: 'set-immediate'},
            {
                name: 'set-interval',
                valid: function() {
                    // faudrais check si y'a beosin de fix des truc sous IE9
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/web.timers.js
                    return true;
                }
            },
            {
                name: 'set-timeout',
                valid: function() {
                    // same as above
                    return true;
                }
            },
            {name: 'url', path: 'URL'},
            {name: 'url-search-params', path: 'URLSearchParams'},
            {name: 'weak-map', type: 'constructor'},
            {name: 'weak-set', type: 'constructor'},

            {name: 'array-buffer', type: 'constructor'},
            {name: 'data-view', type: 'constructor'},
            {name: 'int8-array', type: 'constructor'},
            {name: 'uint8-array', type: 'constructor'},
            {name: 'uint8-clamped-array', type: 'constructor'},
            {name: 'int16-array', type: 'constructor'},
            {name: 'uint16-array', type: 'constructor'},
            {name: 'int32-array', type: 'constructor'},
            {name: 'uint32-array', type: 'constructor'},
            {name: 'float32-array', type: 'constructor'},
            {name: 'float64-array', type: 'constructor'}
        );
        function validDomCollectionIteration() {
            return function() {
                return false;
            };
            // return function(domCollection) {
            //     if (jsenv.isBrowser()) {
            //         return combine(
            //             method(domCollection),
            //             method(domCollection + '.keys'),
            //             method(domCollection + '.values'),
            //             method(domCollection + '.entries'),
            //             method(domCollection + '[Symbol.iterator]')
            //         ).valid;
            //     }
            //     return false;
            // };
        }
        if (jsenv.isBrowser()) {
            registerStandardFeatures('global',
                {
                    name: 'node-list-iteration',
                    path: 'NodeList',
                    valid: validDomCollectionIteration()
                },
                {
                    name: 'dom-token-list-iteration',
                    path: 'DOMTokenList',
                    valid: validDomCollectionIteration()
                },
                {
                    name: 'media-list-iteration',
                    path: 'MediaList',
                    valid: validDomCollectionIteration()
                },
                {
                    name: 'style-sheet-list-iteration',
                    path: 'StyleSheetList',
                    valid: validDomCollectionIteration()
                },
                {
                    name: 'css-rule-list-iteration',
                    path: 'CSSRuleList',
                    valid: validDomCollectionIteration()
                }
            );
        }

        // map, join, filter y'a surement des fix, il ne suffit pas de vérifier que la méthode existe
        registerStandardFeatures('array',
            {name: 'copy-within', path: autoPrototype},
            {name: 'every', path: autoPrototype},
            {name: 'find', path: autoPrototype},
            {name: 'find-index', path: autoPrototype},
            {name: 'fill', path: autoPrototype},
            {name: 'filter', path: autoPrototype},
            {name: 'for-each', path: autoPrototype},
            {name: 'from'},
            {name: 'index-of', path: autoPrototype},
            {name: 'iterator', path: 'Array.prototype[Symbol.iterator]'},
            {name: 'is-array'},
            {name: 'join', path: autoPrototype},
            {name: 'last-index-of', path: autoPrototype},
            {name: 'map', path: autoPrototype},
            {name: 'of'},
            {name: 'reduce', path: autoPrototype},
            {name: 'reduce-right', path: autoPrototype},
            {name: 'slice', path: autoPrototype},
            {name: 'some', path: autoPrototype},
            {name: 'sort', path: autoPrototype}
            // ['species', '???', auto]
        );

        registerStandardFeatures('date',
            {name: 'now'},
            {
                name: 'to-iso-string',
                path: 'Date.prototype.toISOString',
                valid: Predicate.every(
                    function() {
                        // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-iso-string.js
                        return new Date(-5e13 - 1).toISOString() === '0385-07-25T07:06:39.999Z';
                    },
                    Predicate.fails(function() {
                        // eslint-disable-next-line no-unused-expressions
                        new Date(NaN).toISOString();
                    })
                )
            },
            {
                name: 'to-json',
                path: 'Date.prototype.toJSON',
                valid: Predicate.every(
                    function() {
                        // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-json.js
                        return new Date(NaN).toJSON() === null;
                    },
                    function() {
                        var fakeDate = {
                            toISOString: function() {
                                return 1;
                            }
                        };
                        return Date.prototype.toJSON.call(fakeDate) === 1;
                    }
                )
            },
            {name: 'to-primitive', path: 'Date.prototype[Symbol.toPrimitive]'},
            {
                name: 'to-string',
                valid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.date.to-string.js
                    return new Date(NaN).toString() === 'Invalid Date';
                }
            }
        );

        registerStandardFeatures('function',
            {name: 'bind', path: autoPrototype},
            {name: 'name', path: autoPrototype},
            {name: 'has-instance', path: 'Function.prototype[Symbol.hasInstance]'}
        );

        registerStandardFeatures('object',
            {name: 'assign'},
            {name: 'create'},
            {name: 'define-getter', path: 'Object.__defineGetter__', spec: 'es7'},
            {name: 'define-property'},
            {name: 'define-properties', spec: 'es7'},
            {name: 'define-setter', path: 'Object.__defineSetter__', spec: 'es7'},
            {name: 'entries', spec: 'es7'},
            {name: 'freeze'},
            {name: 'get-own-property-descriptor'},
            {name: 'get-own-property-descriptors', spec: 'es7'},
            {name: 'get-own-property-names'},
            {name: 'get-prototype-of'},
            {name: 'is'},
            {name: 'is-extensible'},
            {name: 'is-frozen'},
            {name: 'is-sealed'},
            {name: 'lookup-getter', path: 'Object.__lookupGetter__', spec: 'es7'},
            {name: 'lookup-setter', path: 'Object.__lookupSetter__', spec: 'es7'},
            {name: 'prevent-extensions'},
            {name: 'seal'},
            {name: 'set-prototype-of'},
            {
                name: 'to-string',
                valid: function() {
                    // si on a pas Symbol.toStringTag
                    // https://github.com/zloirock/core-js/blob/master/modules/es6.object.to-string.js
                    var test = {};
                    test[Symbol.toStringTag] = 'z';
                    return test.toString() === '[object z]';
                }
            },
            {name: 'values', spec: 'es7'}
        );

        registerStandardFeatures('symbol',
            {name: ''},
            {name: 'async-iterator', spec: 'es7'},
            {name: 'has-instance'},
            {name: 'iterator'},
            {name: 'match'},
            {name: 'observable', spec: 'es7'},
            {name: 'replace'},
            {name: 'search'},
            {name: 'split'},
            {name: 'to-primitive'}
        );

        registerStandardFeatures('math',
            {name: 'acosh'},
            {name: 'asinh'},
            {name: 'atanh'},
            {name: 'cbrt'},
            {name: 'clamp', spec: 'es7'},
            {name: 'clz32'},
            {name: 'cosh'},
            {name: 'deg-per-rad', path: 'Math.DEG_PER_RAD', spec: 'es7'},
            {name: 'degrees', spec: 'es7'},
            {name: 'expm1'},
            {name: 'fround'},
            {name: 'fscale', spec: 'es7'},
            {name: 'hypot'},
            {name: 'iaddh', spec: 'es7'},
            {name: 'imul'},
            {name: 'imulh', spec: 'es7'},
            {name: 'isubh', spec: 'es7'},
            {name: 'log10'},
            {name: 'log1p'},
            {name: 'log2'},
            {name: 'radians', spec: 'es7'},
            {name: 'rad-per-deg', path: 'Math.RAD_PER_DEG', spec: 'es7'},
            {name: 'scale', spec: 'es7'},
            {name: 'sign'},
            {name: 'sinh'},
            {name: 'tanh'},
            {name: 'trunc'},
            {name: 'umulh', spec: 'es7'}
        );

        registerStandardFeatures('number',
            {
                name: 'constructor',
                path: 'Number',
                valid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.number.constructor.js#L46
                    return (
                        Number(' 0o1') &&
                        Number('0b1') &&
                        !Number('+0x1')
                    );
                }
            },
            {name: 'epsilon', path: 'Number.EPSILON'},
            {name: 'is-finite'},
            {name: 'is-integer'},
            {name: 'is-nan', path: 'Number.isNaN'},
            {name: 'is-safe-integer'},
            {name: 'iterator', path: 'Number.prototype[Symbol.iterator]'},
            {name: 'max-safe-integer', path: 'Number.MAX_SAFE_INTEGER'},
            {name: 'min-safe-integer', path: 'Number.MIN_SAFE_INTEGER'},
            {name: 'to-fixed', path: autoPrototype},
            {name: 'parse-float'},
            {name: 'parse-int'}
        );

        registerStandardFeatures('reflect',
            {name: 'apply'},
            {name: 'construct'},
            {name: 'define-property'},
            {name: 'delete-property'},
            {name: 'enumerate'},
            {name: 'get'},
            {name: 'get-own-property-descriptor'},
            {name: 'get-prototype-of'},
            {name: 'has'},
            {name: 'own-keys'},
            {name: 'prevent-extensions'},
            {name: 'set'},
            {name: 'set-prototype-of'},

            {name: 'define-metadata', spec: 'es7'},
            {name: 'delete-metadata', spec: 'es7'},
            {name: 'get-metadata', spec: 'es7'},
            {name: 'get-metadata-keys', spec: 'es7'},
            {name: 'get-own-metadata', spec: 'es7'},
            {name: 'get-own-metadata-keys', spec: 'es7'},
            {name: 'has-metadata', spec: 'es7'},
            {name: 'has-own-metadata', spec: 'es7'},
            {name: 'metadata', spec: 'es7'}
        );

        registerStandardFeatures('regexp',
            {
                name: 'constructor',
                path: 'RegExp',
                valid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.constructor.js
                    var re1 = /a/g;
                    var re2 = /a/g;
                    re2[Symbol.match] = false;
                    var re3 = RegExp(re1, 'i');
                    return (
                        RegExp(re1) === re1 &&
                        RegExp(re2) !== re2 &&
                        RegExp(re3).toString() === '/a/i'
                    );
                }
            },
            {name: 'escape', path: 'RegExp.escape'},
            {
                name: 'flags',
                path: 'RegExp.prototype.flags',
                valid: function() {
                    // https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.flags.js
                    return /./g.flags === 'g';
                }
            },
            {name: 'match', path: 'RegExp.prototype[Symbol.match]'},
            {name: 'replace', path: 'RegExp.prototype[Symbol.replace]'},
            {name: 'search', path: 'RegExp.prototype[Symbol.search]'},
            {name: 'split', path: 'RegExp.prototype[Symbol.split]'},
            {
                name: 'to-string',
                path: 'RegExp.prototype.toString',
                valid: function() {
                    // https://github.com/zloirock/core-js/blob/master/modules/es6.regexp.to-string.js
                    var toString = RegExp.prototype.toString;
                    return (
                        toString.call({source: 'a', flags: 'b'}) === '/a/b' &&
                        toString.name === 'toString'
                    );
                }
            }
        );

        registerStandardFeatures('string',
            {name: 'at', path: autoPrototype, spec: 'es7'},
            {name: 'from-code-point'},
            {name: 'code-point-at', path: autoPrototype},
            {name: 'ends-with', path: autoPrototype},
            {name: 'escape-html'},
            {name: 'includes', path: autoPrototype},
            {name: 'iterator', path: 'String.prototype[Symbol.iterator]'},
            {name: 'match-all', path: 'String.prototype[Symbol.matchAll]', spec: 'es7'},
            {name: 'pad-end', path: autoPrototype, spec: 'es7'},
            {name: 'pad-start', path: autoPrototype, spec: 'es7'},
            {name: 'raw'},
            {name: 'repeat', path: autoPrototype},
            {name: 'starts-with', path: autoPrototype},
            {name: 'trim', path: autoPrototype},
            {name: 'trim-end', path: autoPrototype},
            {name: 'trim-start', path: autoPrototype},
            {name: 'unescape-html'},

            {name: 'anchor', path: autoPrototype},
            {name: 'big', path: autoPrototype},
            {name: 'blink', path: autoPrototype},
            {name: 'fixed', path: autoPrototype},
            {name: 'fontcolor', path: autoPrototype},
            {name: 'fontsize', path: autoPrototype},
            {name: 'italics', path: autoPrototype},
            {name: 'link', path: autoPrototype},
            {name: 'small', path: autoPrototype},
            {name: 'strike', path: autoPrototype},
            {name: 'sub', path: autoPrototype},
            {name: 'sup', path: autoPrototype}
        );
    });
