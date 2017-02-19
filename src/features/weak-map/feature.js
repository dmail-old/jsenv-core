expose(
    {
        code: feature.runStandard('WeakMap'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.weak-map'
        }
    }
);
