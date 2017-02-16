expose({
    code: transpile`(function(outsideValue, insideValue) {
        let result = outsideValue;
        {
            let result = insideValue;
        }
        return result;
    })`,
    pass: function(fn) {
        var outsideValue = 0;
        var insideValue = 1;
        var result = fn(outsideValue, insideValue);
        return result === outsideValue;
    },
    solution: {
        type: 'babel',
        value: 'transform-es2015-for-of'
    }
});
