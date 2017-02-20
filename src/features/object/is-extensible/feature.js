expose(
    {
        run: feature.runStandard(parent, 'isExtensible'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.is-extensible'
        }
    }
);
