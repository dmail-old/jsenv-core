expose(
    {
        code: transpile`(function() {
            -5 ** 2;
        })`,
        fail: function(error) {
            return error.name === 'SyntaxError';
        }
    }
);
