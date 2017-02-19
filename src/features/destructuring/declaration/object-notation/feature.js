expose(
    {
        code: transpile`(function(value) {
            var {a} = value;
            return a;
        })`,
        pass: function(fn) {
            var value = 1;
            var result = fn({a: value});
            return result === value;
        }
    }
);
