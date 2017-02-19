expose(
    {
        code: feature.runStandard('regeneratorRuntime'),
        pass: feature.standardPresence,
        solution: {
            type: 'file',
            value: '${rootFolder}/node_modules/regenerator-runtime/runtime.js'
        }
    }
);
