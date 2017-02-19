expose(
    {
        code: feature.runStandard('MIN_SAFE_INTEGER'),
        pass: feature.runStandard,
        solution: {
            type: 'corejs',
            value: 'es6.number.min-safe-integer'
        }
    }
);
