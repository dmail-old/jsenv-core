expose(
    {
        code: transpile`(function() {
            if (true) let result = 1;
        })`,
        fail: function(error) {
            return error.name === 'SyntaxError';
        },
        solution: 'none'
    }
);
