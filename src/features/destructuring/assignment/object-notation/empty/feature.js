expose(
    {
        run: transpile`(function() {
            ({} = {a:1, b:2});
        })`,
        pass: function(fn) {
            fn();
            return true;
        }
    }
);
