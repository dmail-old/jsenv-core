/* globals asap */

import {at, present, every} from '/test-helpers.js';

const test = {
    run: at('asap'),
    complete: every(
        present,
        function(_, pass, fail) {
            let setTimeoutCalledBeforeAsap = false;

            return new jsenv.Thenable(function(resolve) {
                setTimeout(function() {
                    setTimeoutCalledBeforeAsap = true;
                }, 1);

                asap(function() {
                    if (setTimeoutCalledBeforeAsap) {
                        resolve(
                            pass('called-after-set-timeout')
                        );
                    } else {
                        resolve(
                            fail('called-after-set-timeout')
                        );
                    }
                });
            });
        }
    )
};

export default test;
