expose(
    {
        run: feature.runStandard('Uint8Array'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.typed.uint8-array'
        }
    }
);
