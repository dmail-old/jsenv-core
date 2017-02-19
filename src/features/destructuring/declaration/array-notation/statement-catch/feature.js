expose(
    {
        code: transpile`(function(value) {
            try {
                throw value;
            } catch ([a]) {
                return a;
            }
        })`,
        pass: function(fn) {
            var value = 1;
            var result = fn([value]);
            return result === value;
        }
    }
);
