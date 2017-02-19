expose(
    {
        code: parent.code,
        pass: jsenv.Predicate.fails(function(fn) {
            new fn(); // eslint-disable-line no-new,new-cap
        }),
        solution: parent.solution
    }
);
