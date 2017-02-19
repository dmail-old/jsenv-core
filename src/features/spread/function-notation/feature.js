expose(
    {
        code: transpile`(function(method, args) {
            return method(...args);
        })`,
        pass: function(fn) {
            var method = Math.max;
            var args = [1, 2, 3];
            var result = fn(method, args);

            return result === method.apply(null, args);
        }
    }
);
