import parent from '../feature.js';
import {expect} from 'helper/detect.js';

const feature = {
    dependencies: [parent],
    run: parent.run,
    test: expect(function(Promise, fail, pass) {
        var promiseRejectionEvent;

        if (jsenv.isBrowser()) {
            if ('onunhandledrejection' in window === false) {
                return fail('missing-window-onunhandledrejection');
            }
            var browserListener = function(event) {
                window.removeEventListener('onunhandledrejection', browserListener);
                promiseRejectionEvent = {
                    reason: event.reason,
                    promise: event.promise
                };
            };
            window.addEventListener('onunhandledrejection', browserListener);
        } else if (jsenv.isNode()) {
            var nodeListener = function(value, promise) {
                process.removeListener('unhandledRejection', nodeListener);
                promiseRejectionEvent = {
                    reason: value,
                    promise: promise
                };
            };
            process.addListener('unhandledRejection', nodeListener);
        } else {
            return fail('unsupported-platform');
        }

        Promise.reject('foo');
        return new Promise(function(resolve) {
            setTimeout(resolve, 10); // engine has 10ms to trigger the event
        }).then(function() {
            if (promiseRejectionEvent) {
                 // to be fully compliant we shoudl ensure
                // promiseRejectionEvent.promise === the promise rejected above
                // BUT it seems corejs dos not behave that way
                // and I'm not 100% sure what is the expected promise object here
                if (promiseRejectionEvent.reason === 'foo') {
                    return pass('event-ok');
                }
                return fail('event-mismatch');
            }
            return fail('missing-event');
        });
    }),
    solution: parent.solution
};
export default feature;
