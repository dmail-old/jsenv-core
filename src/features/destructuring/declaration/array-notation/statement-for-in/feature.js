this.code = transpile`(function(value) {
    for (var [a, b] in value);
    return [a, b];
})`;
this.pass = function(fn) {
    var value = {fo: 1};
    var result = fn(value);
    return this.sameValues(result, ['f', 'o']);
};
this.solution = 'inherit';
