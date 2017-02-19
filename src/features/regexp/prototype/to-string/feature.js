// https://github.com/zloirock/core-js/blob/master/modules/es6.regexp.to-string.js
expose(
    {
        code: feature.runStandard(parent, 'toString'),
        pass: function(regexpPrototypeToString) {
            var fakeRegExp = {source: 'a', flags: 'b'};
            return (
                regexpPrototypeToString.call(fakeRegExp) === '/a/b' &&
                toString.name === 'toString'
            );
        },
        solution: {
            type: 'corejs',
            value: 'es6.regexp.to-string'
        }
    }
);
