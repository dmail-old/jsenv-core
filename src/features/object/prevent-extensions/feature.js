expose(
    {
        code: feature.runStandard(parent, 'prveentExtensions'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es6.object.prevent-extensions'
        }
    }
);
