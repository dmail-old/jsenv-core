expose(
    'symbol/match',
    function(symbolMatch) {
        return {
            run: feature.runStandard(parent, symbolMatch),
            pass: feature.runStandard,
            solution: {
                type: 'corejs',
                value: 'es6.regexp.match'
            }
        };
    }
);
