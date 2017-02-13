this.code = function() {
    return jsenv;
};
this.pass = function(jsenv) {
    return typeof jsenv === 'object';
};
this.solution = 'none';
