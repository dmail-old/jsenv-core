this.dependencies = ['for-of'];
this.code = transpile`(function(value) {
    var scopes = [];
    for(const i of value) {
        scopes.push(function() {
            return i;
        });
    }
    return scopes;
})`;
this.pass = function(fn) {
    var value = ['a', 'b'];
    var scopes = fn(value);
    var scopeValues = jsenv.Iterable.map(scopes, function(scope) {
        return scope();
    });
    return this.sameValues(scopeValues, value);
};
this.solution = {
    type: 'transpile',
    name: 'transform-es2015-for-of'
};
