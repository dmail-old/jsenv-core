expose({
    code: feature.runStandard(parent, dependency('symbol/iterator')),
    pass: parent.pass,
    solution: {
        type: 'corejs',
        name: 'es6.array.iterator'
    }
});
