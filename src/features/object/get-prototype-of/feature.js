expose(
    {
        code: feature.runStandard(parent, 'getPrototypeOf'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.get-prototype-of'
        }
    }
);
