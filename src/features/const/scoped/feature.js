expose(
    {
        run: transpile`(function(outsideValue, insideValue) {
            const a = outsideValue;
            {
                const a = insideValue;
            }
            return a;
        })`,
        pass: function(fn) {
            var outsideValue = 0;
            var insideValue = 1;
            var returnValue = fn(outsideValue, insideValue);
            return returnValue === outsideValue;
        }
    }
);
