this.dependsOn('for-of');
this.code = transpile`(function(iterable) {
    for(var [a, b] of iterable);
    return [a, b];
})`;
this.pass = function(fn) {
    var data = [0, 1];
    var result = fn([data]);
    return this.sameValues(result, data);
};
this.solution = 'inherit';
