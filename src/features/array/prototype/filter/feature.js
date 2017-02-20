expose(
    {
        run: feature.runStandard(parent, 'filter'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.filter'
        }
    }
);
