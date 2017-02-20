expose(
    {
        run: transpile`(async function(value) {
            throw value;
        })`,
        pass: function(fn, settle) {
            var value;
            var result = fn(value);
            if (result instanceof Promise === false) {
                return false;
            }
            result.catch(function(rejectionValue) {
                settle(rejectionValue === value);
            });
        }
    }
);
