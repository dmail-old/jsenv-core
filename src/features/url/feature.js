expose(
    {
        run: feature.runStandard('URL'),
        pass: feature.standardPresence,
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);
