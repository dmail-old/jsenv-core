// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions

expose(
    {
        run: transpile`((a) => a)`,
        pass: function(fn) {
            var value = 1;
            var result = fn(value);
            return result === value;
        },
        solution: {
            type: 'babel',
            value: 'transform-es2015-arrow-functions'
        }
    }
);
