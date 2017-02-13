this.code = transpile`(function(value) {
    ({a} = {a: value});
    return a;
})`;
this.pass = function(fn) {
    var value = 1;
    var result = fn(value);
    return result === value;
};
this.solution = 'inherit';
