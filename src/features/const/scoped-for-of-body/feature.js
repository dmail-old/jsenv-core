import {transpile, sameValues} from '/helper/detect.js';
import {test as constTest} from '../feature.js';
import {test as forOfTest} from '/for-of/feature.js';

const test = {
    dependencies: [constTest, forOfTest],
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
export {test};

export {solution} from '../feature.js';
