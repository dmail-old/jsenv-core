expose(
    {
        run: feature.runStandard('trim'),
        pass: feature.standardPresence,
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);
