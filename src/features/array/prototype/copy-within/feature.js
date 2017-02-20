expose(
    {
        run: feature.runStandard(parent, 'copyWithin'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.copy-within'
        }
    }
);
