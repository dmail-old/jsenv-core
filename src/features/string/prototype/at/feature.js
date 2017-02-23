expose(
    {
        run: feature.runStandard('at'),
        pass: feature.standardPresence,
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);
