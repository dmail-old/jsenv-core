expose({
    code: feature.runStandard(parent, dependency('symbol/to-primitive')),
    pass: parent.pass,
    solution: {
        type: 'corejs',
        name: 'es6.date.to-primitive'
    }
});
