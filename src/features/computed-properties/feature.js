this.code = transpile`(function(name, value) {
    return {[name]: value};
})`;
this.pass = function(fn) {
    var name = 'y';
    var value = 1;
    var result = fn(name, value);
    return result[name] === value;
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-computed-properties'
};
