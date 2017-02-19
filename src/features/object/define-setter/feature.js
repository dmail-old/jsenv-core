expose(
    {
        code: feature.runStandard(parent, '__defineSetter__'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es7.object.define-setter'
        }
    }
);
