expose(
    {
        run: transpile`(function(first, middle, last) {
            var value = [first, middle, last];
            var head;
            var tail;
            [head, ...[value[2], tail]] = value;
            return [value, head, tail];
        })`,
        pass: function(fn) {
            var first = 1;
            var middle = 2;
            var last = 3;
            var result = fn(first, middle, last);

            return (
                this.sameValues(result[0], [first, middle, middle]) &&
                result[1] === first &&
                result[2] === last
            );
        }
    }
);
