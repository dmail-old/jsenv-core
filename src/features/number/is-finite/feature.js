expose(
    {
        code: feature.runStandard('isFinite'),
        pass: feature.runStandard,
        solution: {
            type: 'corejs',
            value: 'es6.number.is-finite'
        }
    }
);
