expose(
    {
        pass: jsenv.Predicate.fails(function(fn) {
            fn(null);
        }, {name: 'TypeError'})
    }
);
