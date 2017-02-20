expose(
    {
        run: feature.runStandard(parent, 'hasInstance'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.symbol.has-instance'
        }
    }
);
