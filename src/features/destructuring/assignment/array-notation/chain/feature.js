this.code = transpile`(function(value) {
    var a, b;
    ([a] = [b] = [value]);
    return [a, b];
})`;
this.pass = function(fn) {
    var value = 1;
    var result = fn(value);
    return this.sameValues(result, [value, value]);
};

this.solution = 'inherit';
