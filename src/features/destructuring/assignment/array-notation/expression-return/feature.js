this.code = transpile`(function(value) {
    var a;
    return ([a] = value);
})`;
this.pass = function(fn) {
    var value = [];
    var result = fn(value);
    return result === value;
};
this.solution = 'inherit';
