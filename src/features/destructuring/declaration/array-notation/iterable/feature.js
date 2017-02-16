expose({
    dependencies: ['symbol/iterator'],
    code: transpile`(function(value) {
        var [a, b, c] = value;
        return [a, b, c];
    })`,
    pass: function(fn) {
        var data = [1, 2];
        var iterable = this.createIterableObject(data);
        var result = fn(iterable);

        return this.sameValues(result, [1, 2, undefined]);
    },
    solution: parent.solution
});
