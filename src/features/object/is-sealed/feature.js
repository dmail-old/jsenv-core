expose(
    {
        code: feature.runStandard(parent, 'isSealed'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.is-sealed'
        }
    }
);
