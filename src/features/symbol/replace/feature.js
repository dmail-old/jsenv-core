expose(
    {
        run: feature.runStandard(parent, 'replace'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.symbol.replace'
        }
    }
);
