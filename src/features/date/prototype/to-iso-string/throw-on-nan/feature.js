expose(
    {
        code: parent.code,
        pass: jsenv.Predicate.fails(function(datePrototypeToISOString) {
            datePrototypeToISOString.call(NaN); // eslint-disable-line no-unused-expressions
        }),
        solution: parent.solution
    }
);
