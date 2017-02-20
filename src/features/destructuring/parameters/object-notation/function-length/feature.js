expose(
    {
        run: transpile`(function({a}) {})`,
        pass: function(fn) {
            return fn.length === 1;
        }
    }
);
