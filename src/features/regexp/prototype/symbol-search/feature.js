expose(
    'symbol/search',
    function(symbolSearch) {
        return {
            code: feature.runStandard(parent, symbolSearch),
            pass: feature.runStandard,
            solution: {
                type: 'corejs',
                value: 'es6.regexp.search'
            }
        };
    }
);
