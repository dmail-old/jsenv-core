expose(
    {
        run: transpile`(function(value) {
            return {
                async a(){
                    return await value;
                }
            };
        })`,
        pass: function(fn, settle) {
            var value;
            var result = fn(value);
            var promise = result.a();
            promise.then(function(resolutionValue) {
                settle(resolutionValue === value);
            });
        }
    }
);
