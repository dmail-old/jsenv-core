expose(
    'symbol',
    'computed-properties',
    {
        code: transpile`(function() {
            var first = Symbol('foo');
            var second = Symbol();
            return {
                first: first,
                second: second,
                [first]: function() {},
                [second]: function() {}
            };
        })`,
        pass: function(fn) {
            var result = fn();

            return (
                result[result.first].name === '[foo]' &&
                result[result.second].name === ''
            );
        },
        solution: 'none'
    }
);
