expose(
    {
        code: transpile`(function(tag, value) {
            return tag \`foo\n\$\{value\}\`;
        })`,
        pass: function(fn) {
            var called = false;
            var calledWith;
            var value = 1;
            function tag() {
                called = true;
                calledWith = arguments;
            }
            fn(tag, value);
            var parts = calledWith[0];
            return (
                called &&
                this.sameValues(parts, ['foo\n']) &&
                this.sameValues(parts.raw, ['foo\\n']) &&
                this.sameValues(calledWith.slice(1), [value])
            );
        },
        solution: parent.solution
    }
);
