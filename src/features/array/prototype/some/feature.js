expose(
    {
        code: feature.runStandard(parent, 'some'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.some'
        }
    }
);
