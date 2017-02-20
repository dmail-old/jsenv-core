expose(
    {
        run: feature.runStandard(parent, 'entries'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es7.object.entries'
        }
    }
);
