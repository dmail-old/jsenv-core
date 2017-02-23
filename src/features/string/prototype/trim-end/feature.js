expose(
    {
        run: feature.runStandard('trimEnd'),
        pass: feature.standardPresence,
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);
