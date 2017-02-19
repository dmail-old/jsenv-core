// https://github.com/zloirock/core-js/blob/master/modules/es6.object.to-string.js

expose(
    'symbol/to-string-tag',
    function(symbolToStringTag) {
        return {
            pass: function(objectPrototypeToString) {
                var object = {};
                var name = 'a';
                object[symbolToStringTag] = name;
                return objectPrototypeToString.call(object) === '[object ' + name + ']';
            },
            solution: {
                type: 'corejs',
                value: 'es6.object.to-string'
            }
        };
    }
);
