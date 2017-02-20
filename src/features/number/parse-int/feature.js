expose(
    {
        run: feature.runStandard('parseInt'),
        pass: feature.runStandard,
        solution: {
            type: 'corejs',
            value: 'es6.number.parse-int'
        }
    }
);
