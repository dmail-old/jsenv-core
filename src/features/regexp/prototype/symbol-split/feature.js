expose(
    'symbol/split',
    function(symbolSplit) {
        return {
            run: feature.runStandard(parent, symbolSplit),
            pass: feature.runStandard,
            solution: {
                type: 'corejs',
                value: 'es6.regexp.split'
            }
        };
    }
);

