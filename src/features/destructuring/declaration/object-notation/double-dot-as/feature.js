expose(
    {
        code: transpile`(function(value) {
            var {x:a} = value;
            return a;
        })`,
        pass: function(fn) {
            var value = 1;
            var result = fn({x: value});
            return result === value;
        }
    }
);
