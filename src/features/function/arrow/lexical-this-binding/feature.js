expose(
    {
        run: transpile`(function() {
            return () => this;
        })`,
        pass: function(fn) {
            var value = 1;
            var arrow = fn.call(value);
            var result = arrow();
            return result === value;
        }
    }
);
