expose(
    {
        code: feature.runStandard('Int16Array'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.typed.int8-array'
        }
    }
);
