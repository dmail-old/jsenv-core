expose(
    {
        run: feature.runStandard(parent, 'split'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.symbol.split'
        }
    }
);
