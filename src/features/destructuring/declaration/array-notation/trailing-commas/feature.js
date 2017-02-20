expose(
    {
        run: transpile`(function(value) {
            var [a,] = value;
            return a;
        })`,
        pass: function(fn) {
            var value = 0;
            var result = fn([value]);
            return result === value;
        }
    }
);
