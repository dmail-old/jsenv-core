expose(
    {
        code: transpile`(function * generator(spy) {
            try {
                yield 1;
                yield 2;
            } catch (e) {
                spy.throwedValue = e;
            }
        })`,
        pass: function(generatorFn) {
            var spy = {};
            var value = 10;
            var iterator = generatorFn(spy);
            iterator.throw(value);
            return spy.throwedValue === value;
        }
    }
);
