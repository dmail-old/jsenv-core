expose(
    {
        run: feature.runStandard(parent, '__lookupSetter__'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.lookup-setter'
        }
    }
);
