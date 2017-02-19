expose(
    {
        code: feature.runStandard('toFixed'),
        pass: feature.runStandard,
        solution: {
            type: 'corejs',
            value: 'es6.number.to-fixed'
        }
    }
);
