import {test as assignTest} from '../feature.js';
const test = {
    dependencies: [assignTest],
    complete() {
        var object = {};
        var symbol = Symbol();
        var value = 1;
        object[symbol] = value;
        var result = Object.assign({}, object);
        return result[symbol] === value;
    }
};
export {test};

export {solution} from '../feature.js';
