expose(
    {
        run: feature.runStandard('Set'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.set'
        }
    }
);
