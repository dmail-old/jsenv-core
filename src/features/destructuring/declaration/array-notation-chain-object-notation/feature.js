this.dependencies = [
    'destructuring-declaration-array-notation',
    'destructuring-declaration-object-notation'
];
this.code = transpile`(function(array, object) {
    var [a] = array, {b} = object;
    return [a, b];
})`;
this.pass = function(fn) {
    var value = 1;
    var result = fn([value], {b: value});
    return this.sameValues(result, [value, value]);
};
this.solution = 'inherit';
