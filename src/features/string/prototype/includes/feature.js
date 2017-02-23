expose(
    {
        run: feature.runStandard('includes'),
        pass: feature.standardPresence,
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);
