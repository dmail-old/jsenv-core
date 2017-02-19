expose(
    {
        code: feature.runStandard(parent, 'asyncIterator'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es7.symbol.async-iterator'
        }
    }
);
