this.code = transpile`(function() {
    (function(a = a) {}());
    (function(a = b, b){}());
})`;
this.pass = jsenv.Predicate.fails(function(fn) {
    fn();
});
this.solution = 'none';
