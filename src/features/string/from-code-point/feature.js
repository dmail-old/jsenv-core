expose(
    {
        run: feature.runStandard('fromCodePoint'),
        pass: function(output, settle) {
            return (
                feature.standardPresence(output, settle) &&
                output.value.length === 1
            );
        },
        solution: {
            type: 'file',
            value: './solution.js'
        }
    }
);


