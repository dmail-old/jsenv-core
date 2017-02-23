expose(
    {
        run: feature.runStandard('escapeHTML'),
        pass: feature.standardPresence,
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);
