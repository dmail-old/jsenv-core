expose(
    'symbol/iterator',
    {
        pass: jsenv.Predicate.fails(function(generatorFn) {
            generatorFn(true);
        })
    }
);
