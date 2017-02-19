expose(
    {
        code: feature.runStandard(parent, 'search'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.symbol.search'
        }
    }
);
