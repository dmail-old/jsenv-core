expose(
    {
        run: feature.runStandard(parent, 'values'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es7.object.values'
        }
    }
);
