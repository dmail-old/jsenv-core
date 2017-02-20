expose(
    'array/prototype/symbol-iterator',
    {
        run: transpile`(function(value) {
            var result = [];
            for (var entry of value) {
                result.push(entry);
            }
            return result;
        })`,
        pass: function(fn) {
            var value = [5];
            var result = fn(value);
            return this.sameValues(result, value);
        },
        solution: {
            type: 'babel',
            value: 'transform-es2015-for-of'
        }
    }
);
