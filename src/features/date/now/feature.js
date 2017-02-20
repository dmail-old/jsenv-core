expose(
    {
        run: feature.runStandard(parent, 'now'),
        solution: {
            type: 'corejs',
            value: 'es6.date.now'
        }
    }
);
