expose(
    {
        run: feature.runStandard('trimStart'),
        pass: feature.standardPresence,
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);
