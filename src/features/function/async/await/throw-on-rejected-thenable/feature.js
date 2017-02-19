expose(
    {
        code: transpile`(async function(thenable) {
            try {
                var result = await thenable;
            } catch (e) {
                return e;
            }
        })`,
        pass: function(fn, settle) {
            var value = 1;
            var thenable = Promise.reject(value);
            var result = fn(thenable);
            return result.then(function(resolutionValue) {
                settle(resolutionValue === value);
            });
        },
        solution: parent.solution
    }
);
