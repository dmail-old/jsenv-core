expose(
    'symbol/iterator',
    {
        code: parent.code,
        pass: function(fn) {
            var data = [1, 2, 3];
            var iterable = this.createIterableObject(data);
            var result = fn(iterable);
            return this.sameValues(result, data);
        },
        solution: {
            type: 'babel',
            value: 'transform-es2015-for-of'
        }
    }
);
