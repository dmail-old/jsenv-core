expose(
    {
        code: feature.runStandard(parent, 'setPrototypeOf'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.set-prototype-of'
        }
    }
);
