expose(
    {
        code: transpile`(function(outsideValue, insideValue) {
            const foo = outsideValue;
            for(const foo = insideValue; false;) {}
            return foo;
        })`,
        pass: function(fn) {
            var outsideValue = 0;
            var insideValue = 1;
            var result = fn(outsideValue, insideValue);
            return result === outsideValue;
        },
        solution: parent.solution
    }
);
