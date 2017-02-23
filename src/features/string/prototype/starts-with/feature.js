expose(
    {
        run: feature.runStandard('startsWith'),
        pass: feature.standardPresence,
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);
