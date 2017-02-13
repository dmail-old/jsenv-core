this.code = transpile`(function(value) {
    let result = value;
    return result;
})`;
this.pass = function(fn) {
    var value = 123;
    var result = fn(value);
    return result === value;
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-block-scoping'
};
