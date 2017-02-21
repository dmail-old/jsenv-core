expose(
    {
        run: feature.runStandard(parent, 'DEG_PER_RAD'),
        pass: parent.pass,
        solution: {
            type: 'inline',
            value: Math.PI / 180
        }
    }
);
