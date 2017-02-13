this.code = transpile`(function() {
    ({} = {a:1, b:2});
})`;
this.pass = function(fn) {
    fn();
    return true;
};
this.solution = 'inherit';
