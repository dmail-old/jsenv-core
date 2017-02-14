this.dependencies = ['symbol-iterator'];
this.code = transpile`(function(value) {
    var [a, b, c] = value;
    return [a, b, c];
})`;
this.pass = function(fn) {
    var data = [1, 2];
    var iterable = this.createIterableObject(data);
    var result = fn(iterable);

    return this.sameValues(result, [1, 2, undefined]);
};
this.solution = 'inherit';
