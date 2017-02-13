this.code = transpile`(function() {
    [] = [1,2];
})`;
this.pass = function(fn) {
    fn();
    return true;
};
this.solution = 'inherit';
