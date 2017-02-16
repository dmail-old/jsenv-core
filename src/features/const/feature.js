expose({
    code: transpile`(function(value) {
        const result = value;
        return result;
    })`,
    pass: function(fn) {
        var value = 1;
        return fn(value) === value;
    },
    solution: {
        type: 'babel',
        value: 'transform-es2015-block-scoping'
    }
});
