this.code = transpile`(function(value) {
    const result = value;
    return result;
})`;
this.pass = function(fn) {
    var value = 1;
    return fn(value) === value;
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-block-scoping'
};
