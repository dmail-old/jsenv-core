this.dependencies.push('array-prototype-symbol-iterator');
this.code = transpile`(function(value) {
    var result = [];
    for (var entry of value) {
        result.push(entry);
    }
    return result;
})`;
this.pass = function(fn) {
    var value = [5];
    var result = fn(value);
    return this.sameValues(result, value);
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-for-of'
};
