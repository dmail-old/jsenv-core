expose(
    'symbol/iterator',
    function(symbolIterator) {
        return {
            code: feature.runStandard(parent, symbolIterator),
            pass: parent.pass,
            solution: {
                type: 'corejs',
                value: 'es6.string.iterator'
            }
        };
    }
);
