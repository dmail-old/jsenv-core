expose(
    {
        run: feature.runStandard(parent, 'from'),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            name: 'es6.array.from'
        }
    }
);
