expose(
    {
        run: feature.runStandard('escape'),
        pass: feature.runStandard,
        solution: {
            type: 'corejs',
            value: 'core.regexp.escape'
        }
    }
);
