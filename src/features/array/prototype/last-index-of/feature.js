expose(
    {
        code: feature.runStandard(parent, 'lastIndexOf'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.last-index-of'
        }
    }
);
