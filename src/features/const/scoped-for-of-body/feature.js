import {transpile, expect, sameValues} from 'helper/detect.js';
import parent from '../feature.js';
import forOfDependency from '//for-of/feature.js';

const feature = {
    dependencies: [parent, forOfDependency],
    run: transpile`(function(value) {
        var scopes = [];
        for(const i of value) {
            scopes.push(function() {
                return i;
            });
        }
        return scopes;
    })`,
    test: expect(function(fn) {
        var value = ['a', 'b'];
        var scopes = fn(value);
        var scopeValues = jsenv.Iterable.map(scopes, function(scope) {
            return scope();
        });
        return sameValues(scopeValues, value);
    }),
    solution: parent.solution
};

export default feature;
