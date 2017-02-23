expose(
    {
        run: transpile`(function() {
            return a => arguments[0];
        })`,
        pass: function(fn) {
            var value = 1;
            var otherValue = 2;
            var arrowFn = fn(value);
            var result = arrowFn(otherValue);
            return result === value;
        }
    }
);

