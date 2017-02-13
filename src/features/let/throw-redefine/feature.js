this.code = transpile`(function() {
    const foo = 1;
    foo = 2;
})`;
this.pass = jsenv.Predicate.fails(function(fn) {
    fn();
};
this.solution = 'none';
