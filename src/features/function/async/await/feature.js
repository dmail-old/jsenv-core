expose(
    {
        code: transpile`(async function(thenable) {
            var result = await thenable;
            return result;
        })`,
        pass: function(fn, settle) {
            var value = 10;
            var thenable = Promise.resolve(value);
            var result = fn(thenable);
            return result.then(function(resolutionValue) {
                settle(resolutionValue === value);
            });
        }
    }
);
