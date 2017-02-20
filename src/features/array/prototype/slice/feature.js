expose(
    {
        run: feature.runStandard(parent, 'slice'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.slice'
        }
    }
);
