expose(
    {
        code: feature.runStandard(parent, 'freeze'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.freeze'
        }
    }
);
