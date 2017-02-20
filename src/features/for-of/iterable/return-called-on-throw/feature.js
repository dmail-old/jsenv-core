expose(
    {
        run: transpile`(function(value, throwedValue) {
            for (var it of value) {
                throw throwedValue;
            }
        })`,
        pass: function(fn) {
            var called = false;
            var iterable = this.createIterableObject([1], {
                'return': function() { // eslint-disable-line
                    called = true;
                    return {};
                }
            });
            var throwedValue = 0;

            try {
                fn(iterable, throwedValue);
            } catch (e) {
                return (
                    e === throwedValue &&
                    called
                );
            }
            return false;
        }
    }
);
