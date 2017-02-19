expose(
    {
        code: feature.runStandard('Uint8ClampedArray'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.typed.uint8-clamped-array'
        }
    }
);
