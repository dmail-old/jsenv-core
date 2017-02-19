expose(
    {
        code: transpile`(function(name, value) {
            return {
                * [name]() {
                    yield value;
                }
            };
        })`,
        pass: function(fn) {
            var name = 'foo';
            var value = 1;
            var result = fn(name, value);
            var generator = result[name]();
            return this.sameValues(generator, [value]);
        }
    }
 );
