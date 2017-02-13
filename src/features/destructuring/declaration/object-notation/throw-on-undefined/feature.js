this.code = 'inherit';
this.pass = jsenv.Predicate.fails(function(fn) {
    fn(undefined);
}, {name: 'TypeError'});
this.solution = 'inherit';
