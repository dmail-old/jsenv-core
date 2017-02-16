expose({
    code: feature.runStandard(parent, 'create'),
    pass: parent.pass,
    solution: {
        type: 'corejs',
        name: 'es6.object.create'
    }
});
