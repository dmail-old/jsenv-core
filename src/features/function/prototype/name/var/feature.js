expose(
    {
        code: transpile`(function() {
            var a = function() {};
            var b = function c() {};
            return [a, b];
        })`,
        pass: function(fn) {
            var result = fn();
            return (
                result[0].name === 'a' &&
                result[1].name === 'c'
            );
        },
        solution: {
            type: 'transpile',
            name: 'transform-es2015-function-name'
        }
    }
);
