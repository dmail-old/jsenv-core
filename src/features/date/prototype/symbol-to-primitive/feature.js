expose(
    'symbol/to-primitive',
    function(symbolToPrimitive) {
        return {
            code: feature.runStandard(parent, symbolToPrimitive),
            pass: parent.pass,
            solution: {
                type: 'corejs',
                name: 'es6.date.to-primitive'
            }
        };
    }
);
