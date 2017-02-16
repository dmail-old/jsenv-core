expose({
    dependencies: ['symbol/iterator'],
    code: parent.code,
    pass: function(fn) {
        var method = Math.max;
        var data = [1, 2, 3];
        var iterable = this.createIterableObject(data);
        var result = fn(method, iterable);

        return result === method.apply(null, data);
    },
    solution: parent.solution
});
