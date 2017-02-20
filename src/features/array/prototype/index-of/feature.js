expose(
    {
        run: feature.runStandard(parent, 'indexOf'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.index-of'
        }
    }
);
