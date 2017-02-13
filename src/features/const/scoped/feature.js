this.code = transpile`(function(outsideValue, insideValue) {
    const result = outsideValue;
    {
        const result = insideValue;
    }
    return result;
})`;
this.pass = function(fn) {
    var outsideValue = 0;
    var insideValue = 1;
    var result = fn(outsideValue, insideValue);
    return result === outsideValue;
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-for-of'
};
