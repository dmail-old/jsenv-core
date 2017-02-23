expose(
    {
        run: feature.runStandard('unescapeHTML'),
        pass: feature.standardPresence,
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);
