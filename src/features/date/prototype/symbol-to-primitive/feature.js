expose(
    'symbol/to-primitive',
    function(symbolToPrimitive) {
        return {
            run: feature.runStandard(parent, symbolToPrimitive),
            solution: {
                type: 'corejs',
                name: 'es6.date.to-primitive'
            }
        };
    }
);
