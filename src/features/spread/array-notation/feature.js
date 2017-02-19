expose(
    {
        code: transpile`(function(value) {
            return [...value];
        })`,
        pass: function(fn) {
            var value = [1, 2, 3];
            var result = fn(value);
            return this.sameValues(result, value);
        },
        solution: parent.solution
    }
);
