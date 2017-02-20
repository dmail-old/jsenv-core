expose(
    {
        run: feature.runStandard(parent, 'assign'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.assign'
        }
    }
);
