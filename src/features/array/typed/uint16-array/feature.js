expose(
    {
        run: feature.runStandard('Uint16Array'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.typed.uint16-array'
        }
    }
);
