expose(
    {
        code: transpile`(function(value, operand) {
            value **= operand;
            return value;
        })`,
        pass: function(fn) {
            return fn(2, 3) === 8;
        }
    }
);
