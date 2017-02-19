expose(
    {
        code: transpile`(function() {
            return {
                set e(...args) {}
            };
        })`,
        fail: function(error) {
            return error instanceof Error;
        },
        solution: 'none'
    }
);
