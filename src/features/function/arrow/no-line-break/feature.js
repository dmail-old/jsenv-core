expose(
    {
        run: transpile`(()
        => 2)`,
        fail: function(error) {
            return error.name === 'SyntaxError';
        }
    }
);
