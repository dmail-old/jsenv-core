expose(
    {
        run: feature.runStandard('isNaN'),
        pass: feature.runStandard,
        solution: {
            type: 'corejs',
            value: 'es6.number.is-nan'
        }
    }
);
