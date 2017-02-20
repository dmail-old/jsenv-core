expose(
    {
        run: transpile`(function * generator(value) {
            yield this.value;
        })`,
        pass: function(fn) {
            var value = 1;
            var object = {value: value};
            var iterator = fn.call(object);
            return this.sameValues(iterator, [value]);
        }
    }
);
