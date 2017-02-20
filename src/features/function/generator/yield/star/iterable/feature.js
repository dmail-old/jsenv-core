expose(
    'iterable-behaviour',
    {
        run: transpile`(function * generator(value) {
            yield * value;
        })`,
        pass: function(generatorFn) {
            var data = [1, 2];
            var iterable = this.createIterableObject(data);
            var generator = generatorFn(iterable);

            return this.sameValues(generator, data);
        }
    }
);
