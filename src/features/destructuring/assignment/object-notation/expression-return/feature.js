expose(
    {
        run: transpile`(function(value) {
            var a;
            return ({a} = value);
        })`,
        pass: function(fn) {
            var value = {};
            var result = fn(value);
            return result === value;
        }
    }
);
