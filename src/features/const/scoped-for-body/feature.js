import {transpile, sameValues, collectKeys} from '/helper/detect.js';
import {test as constTest} from '../feature.js';
const test = {
    dependencies: [constTest],
    run: transpile`(function(value) {
        var scopes = [];
        for(const i in value) {
            scopes.push(function() {
                return i;
            });
        }
        return scopes;
    })`,
    complete(fn) {
        var value = [0, 1];
        var scopes = fn(value);
        var scopeValues = jsenv.Iterable.map(scopes, function(scope) {
            return scope();
        });
        return sameValues(scopeValues, collectKeys(value));
    }
};
export {test};

export {solution} from '../feature.js';
