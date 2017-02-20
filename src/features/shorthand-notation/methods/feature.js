expose(
    {
        run: transpile`(function() {
            return {
                y() {}
            };
        })`,
        pass: function(fn) {
            var result = fn();
            return typeof result.y === 'function';
        }
    }
);
