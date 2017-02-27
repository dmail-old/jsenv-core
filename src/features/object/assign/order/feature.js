import {test as assignTest} from '../feature.js';
import {sameValues, collectKeys} from '/helper/detect.js';
const test = {
    dependencies: [assignTest],
    complete() {
        var keys = 'abcdefghijklmnopqrst'.split('');
        var object = {};
        keys.forEach(function(key) {
            object[key] = key;
        });
        var result = Object.assign({}, object);
        return sameValues(collectKeys(result), keys);
    }
};
export {test};

export {solution} from '../feature.js';
