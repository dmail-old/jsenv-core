expose(
    {
        code: transpile`(function([a]) {
            return a;
        })`,
        pass: function(fn) {
            var value = 1;
            var result = fn([value]);
            return result === value;
        }
    }
);
