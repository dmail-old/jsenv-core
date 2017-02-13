this.code = transpile`(function(defaultValue) {
    return function(a = defaultValue) {
        a = 10;
        return arguments;
    };
})`;
this.pass = function(fn) {
    var defaultValue = 1;
    var value = 2;
    var result = fn(defaultValue)(value);
    return this.sameValues(result, [value]);
};
this.solution = 'inherit';
