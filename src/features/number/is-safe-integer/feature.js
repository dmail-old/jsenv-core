expose(
    {
        run: feature.runStandard('isSafeInteger'),
        pass: feature.runStandard,
        solution: {
            type: 'corejs',
            value: 'es6.number.is-safe-integer'
        }
    }
);
