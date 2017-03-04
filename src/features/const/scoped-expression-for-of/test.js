import {transpile, sameValues} from '/test-helpers.js';
import '/for-of/test.js';

const test = {
    run: transpile`(function(value) {
        var scopes = [];
        for(const i of value) {
            scopes.push(function() {
                return i;
            });
        }
        return scopes;
    })`,
    complete(fn) {
        var value = ['a', 'b'];
        var scopes = fn(value);
        var scopeValues = jsenv.Iterable.map(scopes, function(scope) {
            return scope();
        });
        return sameValues(scopeValues, value);
    }
};

export default test;
