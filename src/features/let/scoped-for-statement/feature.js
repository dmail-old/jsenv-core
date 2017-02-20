expose(
    {
        run: transpile`(function(outsideValue, insideValue) {
            let result = outsideValue;
            for(let result = insideValue; false;) {}
            return result;
        })`,
        pass: function(fn) {
            var outsideValue = 0;
            var insideValue = 1;
            var result = fn(outsideValue, insideValue);
            return result === outsideValue;
        }
    }
);
