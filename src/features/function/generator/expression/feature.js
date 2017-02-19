expose(
    {
        code: transpile`(function(value) {
            var generator = function * () {
                yield value;
            };
            return generator;
        })`,
        pass: function(fn) {
            var value = 1;
            var iterator = fn(value);
            return this.sameValues(iterator, [value]);
        },
        solution: parent.solution
    }
);
