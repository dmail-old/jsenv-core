// this.dependencies.push();
expose(
    // 'function/prototype/bind',
    {
        code: transpile`(function() {
            function foo() {}
            var boundFoo = foo.bind({});
            var boundAnonymous = (function() {}).bind({});
            return [boundFoo, boundAnonymous];
        })`,
        pass: function(fn) {
            var result = fn();
            return (
                result[0].name === "bound foo" &&
                result[1].name === "bound "
            );
        },
        solution: 'none'
    }
);
