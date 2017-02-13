this.code = transpile`(function(value) {
    var f = value;
    return ({
        f() {
            return f;
        }
    });
})`;
this.pass = function(fn) {
    var value = 1;
    return fn(value).f() === value;
};
this.solution = 'none';
