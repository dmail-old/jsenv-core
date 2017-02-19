expose(
    'symbol/has-instance',
    function(symbolHasInstance) {
        return {
            code: feature.runStandard(parent, symbolHasInstance),
            solution: {
                type: 'corejs',
                name: 'es6.function.has-instance'
            }
        };
    }
);
