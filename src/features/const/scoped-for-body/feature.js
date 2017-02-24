import {transpile, expect, sameValues, collectKeys} from 'helper/detect.js';
import parent from '../feature.js';

const feature = {
    dependencies: [parent],
    run: transpile`(function(value) {
        var scopes = [];
        for(const i in value) {
            scopes.push(function() {
                return i;
            });
        }
        return scopes;
    })`,
    test: expect(function(fn) {
        var value = [0, 1];
        var scopes = fn(value);
        var scopeValues = jsenv.Iterable.map(scopes, function(scope) {
            return scope();
        });
        return sameValues(scopeValues, collectKeys(value));
    }),
    solution: parent.solution
};

export default feature;
