expose({
    code: feature.runStandard(parent, 'toJSON'),
    pass: parent.pass,
    solution: {
        type: 'corejs',
        value: 'es6.date.to-json'
    }
});
