expose(
    {
        code: feature.runStandard(parent, 'reduceRight'),
        pass: feature.standardPresence,
        solution: {
            type: 'corejs',
            value: 'es6.array.reduce-right'
        }
    }
);
