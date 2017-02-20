expose(
    {
        run: feature.runStandard(parent, 'match'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.symbol.match'
        }
    }
);
