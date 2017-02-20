expose(
    {
        run: transpile`(function(value) {
            var [a, ,b] = value;
            return [a, b];
        })`,
        pass: function(fn) {
            var firstValue = 1;
            var lastValue = 3;
            var result = fn([firstValue, null, lastValue]);
            return this.sameValues(result, [firstValue, lastValue]);
        }
    }
);
