expose({
    code: feature.runStandard('System'),
    pass: feature.standardPresence,
    solution: {
        type: 'file',
        value: '${rootFolder}/node_modules/systemjs/dist/system.src.js'
    }
});
