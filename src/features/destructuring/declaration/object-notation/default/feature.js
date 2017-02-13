this.code = transpile`(function(defaultValues, value) {
    var {a = defaultValues.a, b = defaultValues.b, c = defaultValues.c} = value;
    return [a, b, c];
})`;
this.pass = function(fn) {
    var defaultA = 1;
    var defaultB = 2;
    var defaultC = 3;
    var a = 0;
    var result = fn(
        {
            a: defaultA,
            b: defaultB,
            c: defaultC
        },
        {
            a: a,
            c: undefined
        }
    );
    return this.sameValues(result, [a, defaultB, defaultC]);
};
this.solution = 'inherit';
