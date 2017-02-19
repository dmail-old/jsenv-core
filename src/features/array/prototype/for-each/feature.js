expose(
    {
        code: feature.runStandard(parent, 'forEach'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.for-each'
        }
    }
);
