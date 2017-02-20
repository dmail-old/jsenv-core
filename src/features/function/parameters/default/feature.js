expose(
    {
        run: transpile`(function(defaultA, defaultB) {
            return function(a = defaultA, b = defaultB) {
                return [a, b];
            };
        })`,
        pass: function(fn) {
            var defaultA = 1;
            var defaultB = 2;
            var a = 3;
            var result = fn(defaultA, defaultB)(a);
            return this.sameValues(result, [a, defaultB]);
        }
    }
);
