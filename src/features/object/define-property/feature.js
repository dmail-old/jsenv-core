expose(
    {
        code: feature.runStandard(parent, 'defineProperty'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.define-property'
        }
    }
);
