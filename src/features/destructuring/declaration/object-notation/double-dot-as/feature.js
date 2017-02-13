this.code = transpile`(function(value) {
    var {x:a} = value;
    return a;
})`;
this.pass = function(fn) {
    var value = 1;
    var result = fn({x: value});
    return result === value;
};
this.solution = 'inherit';
