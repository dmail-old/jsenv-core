expose(
    {
        run: transpile`(function() {
            (function(a = a) {}());
            (function(a = b, b){}());
        })`,
        pass: jsenv.Predicate.fails(function(fn) {
            fn();
        }),
        solution: 'none'
    }
);
