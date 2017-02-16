expose('symbol/iterator', function(symbolIterator) {
    return {
        code: feature.runStandard(parent, symbolIterator),
        pass: parent.pass,
        solution: {
            type: 'corejs',
            name: 'es6.array.iterator'
        }
    };
});
