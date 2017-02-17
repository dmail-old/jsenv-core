expose(
    {
        code: transpile`(function(value) {
            var result;
            function fn() {
                result = foo;
            }
            let foo = value;
            fn();
            return result;
        })`,
        pass: function(fn) {
            var value = 10;
            var result = fn(value);
            return result === value;
        },
        solution: parent.solution
    }
);
