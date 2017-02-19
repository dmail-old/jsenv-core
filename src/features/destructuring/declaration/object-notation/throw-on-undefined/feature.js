expose(
    {
        pass: jsenv.Predicate.fails(function(fn) {
            fn(undefined);
        }, {name: 'TypeError'})
    }
);
