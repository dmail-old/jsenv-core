expose(
    {
        code: transpile`(function(a, b) {
            return {a, b};
        })`,
        pass: function(fn) {
            var a = 1;
            var b = 2;
            var result = fn(a, b);

            return (
                result.a === a &&
                result.b === b
            );
        }
    }
);
