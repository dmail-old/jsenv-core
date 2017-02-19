expose(
    {
        code: transpile`(function(value) {
            return {
                * generator() {
                    yield value;
                }
            };
        })`,
        pass: function(fn) {
            var value = 1;
            var result = fn(value);
            var generator = result.generator();
            return this.sameValues(generator, [value]);
        },
        solution: parent.solution
    }
 );
