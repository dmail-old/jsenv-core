this.code = 'inherit';
this.pass = jsenv.Predicate.fails(function(fn) {
    fn(null);
}, {name: 'TypeError'});
this.solution = 'inherit';
