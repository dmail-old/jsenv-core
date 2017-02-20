expose(
    {
        run: feature.runStandard(parent, 'is'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.is'
        }
    }
);
