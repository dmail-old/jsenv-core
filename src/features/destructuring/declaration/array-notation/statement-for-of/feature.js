expose(
    'for-of',
    {
        run: transpile`(function(iterable) {
            for(var [a, b] of iterable);
            return [a, b];
        })`,
        pass: function(fn) {
            var data = [0, 1];
            var result = fn([data]);
            return this.sameValues(result, data);
        }
    }
);
