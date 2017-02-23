expose(
    'regexp/prototype/flags',
    'symbol/iterator',
    {
        run: feature.runStandard(parent, 'matchAll'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es7.string.match-all'
        }
    }
);
