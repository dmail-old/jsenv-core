expose(
    {
        run: feature.runStandard('padStart'),
        pass: feature.standardPresence,
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);
