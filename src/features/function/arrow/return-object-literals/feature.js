expose(
    {
        run: transpile`((a) => ({
            value: a
        }))`,
        pass: function(fn) {
            var value = 1;
            var result = fn(value);
            return result.value === value;
        }
    }
);
