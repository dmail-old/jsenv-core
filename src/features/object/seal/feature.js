expose(
    {
        code: feature.runStandard(parent, 'seal'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.seal'
        }
    }
);
