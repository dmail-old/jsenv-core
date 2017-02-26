import {test as assignTest} from '../feature.js';
const test = {
    dependencies: [assignTest],
    complete() {
        var keys = 'abcdefghijklmnopqrst';
        var object = {};
        keys.split('').forEach(function(key) {
            object[key] = key;
        });
        var result = Object.assign({}, object);
        return result.join('') === keys;
    }
};
export {test};

export {solution} from '../feature.js';
