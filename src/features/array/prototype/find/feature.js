expose(
    {
        run: feature.runStandard(parent, 'find'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.find'
        }
    }
);
