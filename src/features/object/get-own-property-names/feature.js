expose(
    {
        run: feature.runStandard(parent, 'getOwnPropertyNames'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.get-own-property-names'
        }
    }
);
