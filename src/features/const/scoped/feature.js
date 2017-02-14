this.code = transpile`(function(outsideValue, insideValue) {
    const a = outsideValue;
    {
        const a = insideValue;
    }
    return a;
})`;
this.pass = function(fn) {
    var outsideValue = 0;
    var insideValue = 1;
    var returnValue = fn(outsideValue, insideValue);
    return returnValue === outsideValue;
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-for-of'
};
