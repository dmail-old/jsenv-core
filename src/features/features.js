/* eslint-env browser, node */
/* globals jsenv */

(function() {
    // var Predicate = jsenv.Predicate;

    function transpile(strings) {
        var result;
        var raw = strings.raw;
        var i = 0;
        var j = raw.length;
        result = raw[i];
        i++;
        while (i < j) {
            result += arguments[i];
            result += raw[i];
            i++;
        }
        return jsenv.createSourceCode(result);
    }
    function sameValues(a, b) {
        if (typeof a === 'string') {
            a = convertStringToArray(a);
        } else if (typeof a === 'object' && typeof a.next === 'function') {
            a = consumeIterator(a);
        }
        if (typeof b === 'string') {
            b = convertStringToArray(b);
        } else if (typeof b === 'object' && typeof b.next === 'function') {
            b = consumeIterator(b);
        }

        if (a.length !== b.length) {
            return false;
        }
        var i = a.length;
        while (i--) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }
    function convertStringToArray(string) {
        var result = [];
        var i = 0;
        var j = string.length;
        while (i < j) {
            var char = string[i];

            if (i < j - 1) {
                var charCode = string.charCodeAt(i);

                // fix astral plain strings
                if (charCode >= 55296 && charCode <= 56319) {
                    i++;
                    result.push(char + string[i]);
                } else {
                    result.push(char);
                }
            } else {
                result.push(char);
            }
            i++;
        }
        return result;
    }
    function consumeIterator(iterator) {
        var values = [];
        var next = iterator.next();
        while (next.done === false) {
            values.push(next.value);
            next = iterator.next();
        }
        return values;
    }
    function createIterableObject(arr, methods) {
        var j = arr.length;
        var iterable = {};
        iterable[Symbol.iterator] = function() {
            var i = -1;
            var iterator = {
                next: function() {
                    i++;
                    return {
                        value: i === j ? undefined : arr[i],
                        done: i === j
                    };
                }
            };
            jsenv.assign(iterator, methods || {});
            iterator.iterable = iterable;

            return iterator;
        };
        return iterable;
    }
    function collectKeys(value) {
        var keys = [];
        for (var key in value) {
            if (value.hasOwnProperty(key)) {
                if (isNaN(key) === false && value instanceof Array) {
                    // key = Number(key);
                    keys.push(key);
                } else {
                    keys.push(key);
                }
            }
        }
        return keys;
    }

    jsenv.collectKeys = collectKeys;
    jsenv.createIterableObject = createIterableObject;

    /*
    this is all about mapping
    https://github.com/babel/babel-preset-env/blob/master/data/plugin-features.js
    with
    https://github.com/kangax/compat-table/blob/gh-pages/data-es5.js
    https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js
    */
    jsenv.registerFeatures(function() {
        /*
        if (jsenv.isBrowser() === false) {
            implementation.exclude('node-list');
            // etc
            // en gros on exclu certains features quand on est pas dans le browser
        }
        */

        // register('spread-function-call-generator', {
        //     // dependencies: ['yield'],
        //     args: '\
        //         return {\
        //             value: (function*() {\
        //                 yield 1;\
        //                 yield 2;\
        //                 yield 3;\
        //             }())\
        //         };\
        //     ',
        //     pass: function(result) {
        //         return result === 3;
        //     }
        // });
        // register('spread-literal-array-generator', {
        //     args: '\
        //         return {\
        //             value: (function*() {\
        //                 yield 1;\
        //                 yield 2;\
        //                 yield 3;\
        //             }())\
        //         };\
        //     ',
        //     pass: function(result) {
        //         return sameValues(result, [1, 2, 3]);
        //     }
        // });
        // register('for-of-generator', {
        //     // dependencies: ['yield'],
        //     body: '\
        //         var result = "";\
        //         var iterable = (function*() {\
        //             yield 1;\
        //             yield 2;\
        //             yield 3;\
        //         }());\
        //         for (var item of iterable) {\
        //             result += item;\
        //         }\
        //         return result;\
        //     ',
        //     pass: function(result) {
        //         return result === '123';
        //     }
        // });
        // register('destructuring-assignement-generator')
        // https://github.com/kangax/compat-table/blob/gh-pages/data-es6.js#L10247
    });
})();
