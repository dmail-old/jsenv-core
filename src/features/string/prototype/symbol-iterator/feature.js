expose({
    code: feature.runStandard(parent, dependency('symbol/iterator')),
    pass: parent.pass,
    solution: {
        type: 'corejs',
        value: 'es6.string.iterator'
    }
});
