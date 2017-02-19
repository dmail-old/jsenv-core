expose(
    {
        pass: function(fn) {
            var defaultA = 1;
            var defaultB = 2;
            var a;
            var b = 4;
            var result = fn(defaultA, defaultB)(a, b);
            return this.sameValues(result, [defaultA, b]);
        }
    }
);
