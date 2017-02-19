expose(
    {
        code: transpile`(function(value) {
            var sent;
            function * generator() {
                sent = [yield value];
            }
            return [
                generator(),
                sent
            ];
        })`,
        pass: function(fn) {
            var value = 1;
            var result = fn(value);
            var iterator = result[0];
            var sent = result[1];
            return (
                this.sameValues(iterator, [value]) &&
                this.sameValues(sent, [value])
            );
        },
        solution: parent.solution
    }
);
