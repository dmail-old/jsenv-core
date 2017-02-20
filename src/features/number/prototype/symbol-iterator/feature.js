expose(
    'symbol/iterator',
    function(symbolIterator) {
        return {
            run: feature.runStandard(parent, symbolIterator),
            pass: feature.runStandard,
            solution: {
                type: 'corejs',
                value: 'core.number.iterator'
            }
        };
    }
);
