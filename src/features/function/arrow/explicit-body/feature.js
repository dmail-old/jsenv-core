expose(
    {
        run: transpile`((a) => {
            a++;
            return a;
        })`,
        pass: function(fn) {
            return fn(1) === 2;
        }
    }
);
