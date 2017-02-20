expose(
    {
        run: feature.runStandard(parent, 'every'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.every'
        }
    }
);
