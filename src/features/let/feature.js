expose(
    {
        code: transpile`(function(value) {
            let result = value;
            return result;
        })`,
        pass: function(fn) {
            var value = 123;
            var result = fn(value);
            return result === value;
        },
        solution: {
            type: 'transpile',
            name: 'transform-es2015-block-scoping'
        }
    }
);
