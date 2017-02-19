expose(
    'symbol/iterator',
    {
        code: parent.code,
        pass: jsenv.Predicate.fails(function(generatorFn) {
            generatorFn(true);
        }),
        solution: parent.solution
    }
);
