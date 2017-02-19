expose(
    'symbol/split',
    function(symbolSplit) {
        return {
            code: feature.runStandard(parent, symbolSplit),
            pass: feature.runStandard,
            solution: {
                type: 'corejs',
                value: 'es6.regexp.split'
            }
        };
    }
);

