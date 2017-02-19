expose(
    {
        code: feature.runStandard(parent, 'observable'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es7.symbol.observable'
        }
    }
);
