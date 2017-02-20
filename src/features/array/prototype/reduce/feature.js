expose(
    {
        run: feature.runStandard(parent, 'reduce'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.reduce'
        }
    }
);
