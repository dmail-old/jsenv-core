expose(
    {
        code: feature.runStandard('Int32Array'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.typed.int32-array'
        }
    }
);
