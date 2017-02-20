expose(
    {
        run: transpile`(function() {
            [] = [1,2];
        })`,
        pass: function(fn) {
            fn();
            return true;
        }
    }
);
