expose(
    {
        run: feature.runStandard(parent, 'findIndex'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.find-index'
        }
    }
);
