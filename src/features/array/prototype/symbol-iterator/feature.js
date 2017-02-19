expose('symbol/iterator', function(symbolIterator) {
    return {
        code: feature.runStandard(parent, symbolIterator),
        solution: {
            type: 'corejs',
            name: 'es6.array.iterator'
        }
    };
});
