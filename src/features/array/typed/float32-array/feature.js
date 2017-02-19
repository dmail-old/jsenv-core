expose(
    {
        code: feature.runStandard('Float32Array'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.typed.float32-array'
        }
    }
);
