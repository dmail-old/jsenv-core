expose(
    {
        run: feature.runStandard(parent, 'defineProperties'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es7.object.define-properties'
        }
    }
);
