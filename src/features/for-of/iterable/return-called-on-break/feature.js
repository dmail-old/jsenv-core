expose(
    {
        code: transpile`(function(value) {
            for (var it of value) {
                break;
            }
        })`,
        pass: function(fn) {
            var called = false;
            var iterable = this.createIterableObject([1], {
                'return': function() {
                    called = true;
                    return {};
                }
            });
            fn(iterable);
            return called;
        }
    }
);
