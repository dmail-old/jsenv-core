expose(
    {
        code: feature.runStandard(parent, 'map'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.map'
        }
    }
);
