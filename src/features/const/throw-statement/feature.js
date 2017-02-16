expose({
    code: transpile`(function() {
        if (true) const bar = 1;
    })`,
    fail: function(error) {
        return error.name === 'SyntaxError';
    },
    solution: 'none'
});
