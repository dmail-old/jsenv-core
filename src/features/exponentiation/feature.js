expose(
    {
        code: transpile`(function(left, right, negate) {
            if (negate) {
                return -(left ** right);
            }
            return left ** right;
        })`,
        pass: function(fn) {
            return (
                fn(2, 3) === 8 &&
                fn(-5, 2) === 25 &&
                fn(5, 2, true) === -25
            );
        },
        solution: {
            type: 'babel',
            name: 'transform-exponentiation-operator'
        }
    }
);
