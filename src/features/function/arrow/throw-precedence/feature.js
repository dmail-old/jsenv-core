expose(
    {
        run: transpile`(0 || () => 2)`,
        fail: function(error) {
            return error.name === 'SyntaxError';
        }
    }
);
