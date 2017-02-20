expose(
    {
        run: feature.runStandard('MAX_SAFE_INTEGER'),
        pass: feature.runStandard,
        solution: {
            type: 'corejs',
            value: 'es6.number.max-safe-integer'
        }
    }
);
