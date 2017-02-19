expose(
    {
        pass: jsenv.Predicate.fails(function(datePrototypeToISOString) {
            datePrototypeToISOString.call(NaN); // eslint-disable-line no-unused-expressions
        })
    }
);
