expose(
    {
        code: transpile`(function(value) {
            ({a} = {a: value});
            return a;
        })`,
        pass: function(fn) {
            var value = 1;
            var result = fn(value);
            return result === value;
        }
    }
);
