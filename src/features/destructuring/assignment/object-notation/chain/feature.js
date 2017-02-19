expose(
    {
        code: transpile`(function(value) {
            var a, b;
            ({a} = {b} = {a: value, b: value});
            return [a, b];
        })`,
        pass: function(fn) {
            var value = 1;
            var result = fn(value);
            return this.sameValues(result, [value, value]);
        }
    }
);
