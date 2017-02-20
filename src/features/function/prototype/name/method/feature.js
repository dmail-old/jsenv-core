expose(
    {
        run: transpile`function() {
            var result = {
                a: function() {},
                b: function c() {};
            };
            result.d = function() {};
            return result;
        })`,
        pass: function(fn) {
            var result = fn();
            return (
                result.a.name === 'a' &&
                result.b.name === 'c' &&
                result.d.name === ''
            );
        },
        solution: 'none'
    }
);
