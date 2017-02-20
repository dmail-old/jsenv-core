expose(
    {
        run: feature.runStandard('parseFloat'),
        pass: feature.runStandard,
        solution: {
            type: 'corejs',
            value: 'es6.number.parse-float'
        }
    }
);
