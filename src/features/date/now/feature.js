expose({
    code: feature.runStandard(parent, 'now'),
    pass: parent.pass,
    solution: {
        type: 'corejs',
        value: 'es6.date.now'
    }
});
