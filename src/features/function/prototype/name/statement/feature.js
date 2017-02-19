expose(
    {
        code: transpile`(function() {
            return [
                function foo() {},
                (function() {})
            ];
        })`,
        pass: function(fn) {
            var result = fn();

            return (
                result[0].name === 'foo' &&
                result[1].name === ''
            );
        },
        solution: {
            type: 'transpile',
            name: 'transform-es2015-function-name'
        }
    }
);
