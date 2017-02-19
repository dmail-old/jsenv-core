expose(
    {
        code: feature.runStandard(parent, '__lookupGetter__'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.lookup-getter'
        }
    }
);
