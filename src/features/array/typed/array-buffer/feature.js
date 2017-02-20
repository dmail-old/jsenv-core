expose(
    {
        run: feature.runStandard('ArrayBuffer'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.typed.array-buffer'
        }
    }
);
