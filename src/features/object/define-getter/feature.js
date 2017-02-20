expose(
    {
        run: feature.runStandard(parent, '__defineGetter__'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            value: 'es7.object.define-getter'
        }
    }
);
