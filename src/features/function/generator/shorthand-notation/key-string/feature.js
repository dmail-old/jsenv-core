expose(
    {
        code: transpile`(function(value) {
            return {
                * "foo bar"() {
                    yield value;
                }
            };
        })`,
        pass: function(fn) {
            var value = 1;
            var result = fn(value);
            var generator = result['foo bar']();
            return this.sameValues(generator, [value]);
        }
    }
 );
