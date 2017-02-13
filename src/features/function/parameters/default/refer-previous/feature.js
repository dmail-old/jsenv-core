this.code = transpile`(function(defaultValue) {
    return function(a = defaultValue, b = a) {
        return [a, b];
    };
})`;
this.pass = function(fn) {
    var defaultValue = 1;
    var result = fn(defaultValue)();
    return this.sameValues(result, [defaultValue, defaultValue]);
};
this.solution = 'inherit';
