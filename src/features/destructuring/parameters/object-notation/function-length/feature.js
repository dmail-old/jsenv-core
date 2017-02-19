expose(
    {
        code: transpile`(function({a}) {})`,
        pass: function(fn) {
            return fn.length === 1;
        }
    }
);
