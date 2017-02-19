expose(
    {
        code: transpile`(function(a) {
            return \`\$\{a\}\`;
        })`,
        pass: function(fn) {
            var value = 1;
            var result = fn({
                toString: function() {
                    return value;
                },
                valueOf: function() {
                    return 'bar';
                }
            });
            return result === String(value);
        },
        solution: parent.solution
    }
);
