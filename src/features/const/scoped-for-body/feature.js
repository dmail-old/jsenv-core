this.code = transpile`(function(value) {
    var scopes = [];
    for(const i in value) {
        scopes.push(function() {
            return i;
        });
    }
    return scopes;
})`;
this.pass = function(fn) {
    var value = [0, 1];
    var scopes = fn(value);
    var scopeValues = jsenv.Iterable.map(scopes, function(scope) {
        return scope();
    });
    return this.sameValues(scopeValues, this.collectKeys(value));
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-for-of'
};
