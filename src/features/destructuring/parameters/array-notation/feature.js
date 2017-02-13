this.code = transpile`(function([a]) {
    return a;
})`;
this.pass = function(fn) {
    var value = 1;
    var result = fn([value]);
    return result === value;
};
this.solution = 'inherit';
