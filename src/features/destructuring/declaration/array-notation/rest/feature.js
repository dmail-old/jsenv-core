expose(
    {
        code: transpile`(function(value) {
            var [a, ...b] = value;
            return [a, b];
        })`,
        pass: function(fn) {
            var firstValue = 1;
            var lastValue = 2;
            var firstResult = fn([firstValue, lastValue]);
            var secondResult = fn([firstValue]);

            return (
                firstResult[0] === firstValue &&
                this.sameValues(firstResult[1], [lastValue]) &&
                secondResult[0] === firstValue &&
                this.sameValues(secondResult[1], [])
            );
        }
    }
);
