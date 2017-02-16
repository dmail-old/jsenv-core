expose({
    code: feature.runStandard('Promise'),
    pass: feature.standardPresence,
    solution: {
        type: 'corejs',
        value: 'es6.promise',
        beforeFix: 'delete Promise;'
    }
});
