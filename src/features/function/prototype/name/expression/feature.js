expose(
    {
        pass: function() {
            return (
                (function foo() {}).name === 'foo' &&
                (function() {}).name === ''
            );
        },
        solution: {
            type: 'transpile',
            name: 'transform-es2015-function-name'
        }
    }
);
