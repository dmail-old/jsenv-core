expose(
    {
        code: transpile`(function(foo, ...rest) {
            return [foo, rest];
        })`,
        pass: function(fn) {
            var first = 1;
            var second = 2;
            var result = fn(first, second);
            return (
                result[0] === first &&
                this.sameValues(result[1], [second])
            );
        }
    }
);
