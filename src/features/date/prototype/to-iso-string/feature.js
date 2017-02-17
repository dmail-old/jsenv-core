expose(
    {
        code: feature.runStandard(parent, 'toISOString'),
        pass: parent.pass,
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);
