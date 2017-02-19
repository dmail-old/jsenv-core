expose(
    {
        code: feature.runStandard('WeakSet'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.weak-set'
        }
    }
);
