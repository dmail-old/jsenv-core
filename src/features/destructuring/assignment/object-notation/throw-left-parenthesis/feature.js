expose(
    {
        code: transpile`(function(value) {
            var a;
            ({a}) = value;
        })`,
        fail: function(error) {
            return error instanceof SyntaxError;
        }
    }
);
