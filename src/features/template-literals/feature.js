expose(
    {
        code: transpile`(function(a) {
            return \`foo
                \$\{a + 'z'\} \$\{a.toUpperCase()\}\`;
        })`,
        pass: function(fn) {
            var value = 'bar';
            var result = fn(value);
            return result === 'foo\nbarz BAR';
        },
        solution: {
            type: 'babel',
            name: 'transform-es2015-template-literals'
        }
    }
);
