expose(
    {
        run: feature.runStandard('repeat'),
        pass: feature.standardPresence,
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);
