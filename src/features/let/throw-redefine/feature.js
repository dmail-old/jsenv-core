expose(
    {
        run: transpile`(function() {
            const foo = 1;
            foo = 2;
        })`,
        pass: jsenv.Predicate.fails(function(fn) {
            fn();
        }),
        solution: 'none'
    }
);
