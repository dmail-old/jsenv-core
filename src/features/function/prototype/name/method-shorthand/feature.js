expose(
    'shorthand-notation/methods',
    {
        run: transpile`(function() {
            return {
                foo() {}
            };
        })`,
        pass: function(fn) {
            return fn().foo.name === 'foo';
        },
        solution: {
            type: 'babel',
            value: 'transform-es2015-function-name'
        }
    }
);
