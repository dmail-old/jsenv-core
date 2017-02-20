expose(
    {
        run: function() {
            return new Function( // eslint-disable-line no-new-func
                "a", "...rest",
                "return [a, rest]"
            );
        },
        pass: function(fn) {
            var first = 1;
            var second = 2;
            var result = fn(first, second);
            return (
                result[0] === first &&
                this.sameValues(result[1], [second])
            );
        }
    }
);
