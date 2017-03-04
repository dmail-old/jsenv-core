// https://github.com/zloirock/core-js/blob/v2.4.1/modules/_parse-int.js

import {at, presence, every} from '/test-helpers.js';
import {whitespaces} from '../parse-float/test.js';

const test = {
    run: at('parseInt'),
    complete: every(
        presence,
        function() {
            return (
                parseInt(whitespaces + '08') === 8 &&
                parseInt(whitespaces + '0x16') === 22
            );
        }
    )
};

export default test;
