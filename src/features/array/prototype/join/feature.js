expose(
    {
        run: feature.runStandard(parent, 'join'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.join'
        }
    }
);
