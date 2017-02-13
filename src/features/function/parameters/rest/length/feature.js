this.code = transpile`(function() {
    return [
        function(a, ...b) {},
        function(...c) {}
    ];
})`;
this.pass = function(fn) {
    var result = fn();

    return (
        result[0].length === 1 &&
        result[1].length === 0
    );
};
this.solution = 'inherit';
