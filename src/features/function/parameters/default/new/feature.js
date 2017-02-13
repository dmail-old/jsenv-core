this.code = function() {
    return function(defaultA, defaultB) {
        return new Function( // eslint-disable-line no-new-func
            "a = " + defaultA, "b = " + defaultB,
            "return [a, b];"
        );
    };
};
this.pass = function(fn) {
    var defaultA = 1;
    var defaultB = 2;
    var a = 3;
    var result = fn(defaultA, defaultB)(a);
    return this.sameValues(result, [a, defaultB]);
};
this.solution = 'none';
