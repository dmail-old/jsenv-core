expose(
    {
        code: transpile`(function() {
            return [
                function(a, ...b) {},
                function(...c) {}
            ];
        })`,
        pass: function(fn) {
            var result = fn();

            return (
                result[0].length === 1 &&
                result[1].length === 0
            );
        }
    }
);
