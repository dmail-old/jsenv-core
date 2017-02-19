expose(
    {
        code: feature.runStandard(parent, 'isArray'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.is-array'
        }
    }
);
