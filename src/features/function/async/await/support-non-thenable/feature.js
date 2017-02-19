expose(
    {
        pass: function(fn, settle) {
            var value = 10;
            var result = fn(value);
            return result.then(function(resolutionValue) {
                settle(resolutionValue === value);
            });
        }
    }
);
