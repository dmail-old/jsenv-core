import {at, present, every} from 'helper/detect.js';

const test = {
    run: at('String', 'fromCodePoint'),
    test: every(present, function(fromCodePoint, pass, fail) {
        if (fromCodePoint.length !== 1) {
            return fail('length-must-be-one');
        }
        return pass();
    })
};
export default test;
