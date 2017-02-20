expose(
    {
        run: transpile`(function * generator(value, spy) {
            try {
                yield *value;
            } finally {
                spy.callOrder = 'closing';
            }
        })`,
        pass: function(fn) {
            var spy = {
                callOrder: ''
            };
            var iterable = this.createIterableObject([1], {
                'return': function() {
                    spy.callOrder += 'return';
                    return {done: true};
                }
            });
            var generator = fn(iterable, spy);
            generator.next();
            generator['return'](); // eslint-disable-line dot-notation
            return spy.callOrder === 'return closing';
        }
    }
);
