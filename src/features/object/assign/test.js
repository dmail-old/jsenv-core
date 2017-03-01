// import testSymbol from '/symbol/test.js';
import {at, present, every, sameValues, collectKeys} from '/test-helpers.js';

const test = {
    run: at('Object', 'assign'),
    complete: every(
        present,
        function() {
            const keys = 'abcdefghijklmnopqrst'.split('');
            const object = {};
            keys.forEach(function(key) {
                object[key] = key;
            });
            const result = Object.assign({}, object);
            return sameValues(collectKeys(result), keys);
        }
        // function() {
        //     const object = {};
        //     const symbol = Symbol();
        //     const value = 1;
        //     object[symbol] = value;
        //     const result = Object.assign({}, object);
        //     return result[symbol] === value;
        // }
    )
};

export default test;
