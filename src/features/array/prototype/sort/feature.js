expose(
    {
        code: feature.runStandard(parent, 'sort'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.sort'
        }
    }
);
