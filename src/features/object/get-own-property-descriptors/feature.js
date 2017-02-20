expose(
    {
        run: feature.runStandard(parent, 'getOwnPropertyDescriptors'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es7.object.get-own-property-descriptors'
        }
    }
);
