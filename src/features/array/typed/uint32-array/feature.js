expose(
    {
        run: feature.runStandard('Uint32Array'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.typed.uint32-array'
        }
    }
);
