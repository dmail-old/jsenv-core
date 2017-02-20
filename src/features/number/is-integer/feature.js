expose(
    {
        run: feature.runStandard('isInteger'),
        pass: feature.runStandard,
        solution: {
            type: 'corejs',
            value: 'es6.number.is-integer'
        }
    }
);
