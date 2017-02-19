expose(
    {
        code: transpile`(async
         function(value) {})`,
        fail: function(error) {
            return error.name === 'SyntaxError';
        }
    }
);
