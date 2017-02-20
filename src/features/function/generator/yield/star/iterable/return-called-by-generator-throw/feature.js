expose(
    {
        run: transpile`(function * generator(value) {
            try {
                yield *value;
            } catch(e) {

            }
        })`,
        pass: function(fn) {
            var closed = false;
            var iterable = this.createIterableObject([1], {
                'throw': undefined,
                'return': function() {
                    closed = true;
                    return {done: true};
                }
            });
            var generator = fn(iterable);
            generator.next();
            generator['throw'](); // eslint-disable-line dot-notation
            return closed;
        }
    }
);
