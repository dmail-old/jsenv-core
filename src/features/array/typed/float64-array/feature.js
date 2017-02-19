expose(
    {
        code: feature.runStandard('Float64Array'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.typed.float64-array'
        }
    }
);
