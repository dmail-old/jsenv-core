expose(
    {
        run: feature.runStandard(parent, 'fill'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.fill'
        }
    }
);
