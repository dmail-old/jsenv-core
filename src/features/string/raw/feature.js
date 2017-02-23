expose(
    {
        run: feature.runStandard('raw'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.string.raw'
        }
    }
);
