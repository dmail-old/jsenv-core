this.code = transpile`(function(a, b) {
    [b, a] = [a, b];
    return [a, b];
})`;
this.pass = function(fn) {
    var a = 1;
    var b = 2;
    var result = fn(a, b);
    return this.sameValues(result, [b, a]);
};
this.solution = 'inherit';
