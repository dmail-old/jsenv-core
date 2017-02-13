this.code = transpile`(function(method, args) {
    return method(...args);
})`;
this.pass = function(fn) {
    var method = Math.max;
    var args = [1, 2, 3];
    var result = fn(method, args);

    return result === method.apply(null, args);
};
this.solution = 'inherit';
