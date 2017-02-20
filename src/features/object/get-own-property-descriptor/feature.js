expose(
    {
        run: feature.runStandard(parent, 'getOwnPropertyDescriptor'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.get-own-property-descriptor'
        }
    }
);
