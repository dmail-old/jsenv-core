expose(
    {
        run: transpile`(function(a = function() {
            return typeof b;
        }) {
            var b = 1;
            return a();
        })`,
        pass: function(fn) {
            return fn() === 'undefined';
        },
        solution: 'none'
    }
);
