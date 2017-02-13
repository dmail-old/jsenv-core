this.code = transpile`(function(a = function() {
    return typeof b;
}) {
    var b = 1;
    return a();
})`;
this.pass = function(fn) {
    return fn() === 'undefined';
};
this.solution = 'none';
