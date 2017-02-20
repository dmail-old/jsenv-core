expose(
    'symbol/replace',
    function(symbolReplace) {
        return {
            run: feature.runStandard(parent, symbolReplace),
            pass: feature.runStandard,
            solution: {
                type: 'corejs',
                value: 'es6.regexp.replace'
            }
        };
    }
);
