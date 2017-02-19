// https://github.com/zloirock/core-js/blob/v2.4.1/modules/es6.regexp.constructor.js
expose(
    'symbol/match',
    function(symbolMatch) {
        return {
            pass: function(RegExp) {
                var re1 = /a/g;
                var re2 = /a/g;
                re2[symbolMatch] = false;
                var re3 = RegExp(re1, 'i');
                return (
                    RegExp(re1) === re1 &&
                    RegExp(re2) !== re2 &&
                    RegExp(re3).toString() === '/a/i'
                );
            },
            solution: {
                type: 'corejs',
                value: 'es6.regexp.constructor'
            }
        };
    }
);
