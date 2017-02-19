expose(
    {
        pass: function(fn) {
            var data = [1, 2];
            var iterable = this.createIterableObject(data);
            var instance = Object.create(iterable);
            var result = fn(instance);

            return this.sameValues(result, [1, 2, undefined]);
        }
    }
);
