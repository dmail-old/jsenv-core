this.code = transpile`(function(value) {
    return [...value];
})`;
this.pass = function(fn) {
    var value = [1, 2, 3];
    var result = fn(value);
    return this.sameValues(result, value);
};
this.solution = 'inherit';
