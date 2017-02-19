expose(
    'symbol/match',
    function(symbolMatch) {
        return {
            code: feature.runStandard(parent, symbolMatch),
            pass: feature.runStandard,
            solution: {
                type: 'corejs',
                value: 'es6.regexp.match'
            }
        };
    }
);
