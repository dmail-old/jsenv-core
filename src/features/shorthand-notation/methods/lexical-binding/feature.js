expose(
    {
        run: transpile`(function(value) {
            var f = value;
            return ({
                f() {
                    return f;
                }
            });
        })`,
        pass: function(fn) {
            var value = 1;
            return fn(value).f() === value;
        },
        solution: 'none'
    }
);
