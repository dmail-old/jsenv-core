import {test as promiseTest} from '../feature.js';
import {listenOnce} from '/helper/detect.js';
const test = {
    dependencies: [promiseTest],
    complete(first, fail, pass) {
        var promiseRejectionEvent;

        if (jsenv.isBrowser()) {
            listenOnce('unhandledRejection', function(event) {
                promiseRejectionEvent = {
                    reason: event.reason,
                    promise: event.promise
                };
            });
        } else if (jsenv.isNode()) {
            listenOnce('unhandledRejection', function(value, promise) {
                promiseRejectionEvent = {
                    reason: value,
                    promise: promise
                };
            });
        } else {
            return fail('unsupported-platform');
        }

        const reason = 'foo';
        const promise = Promise.reject(reason);
        return new Promise(function(resolve) {
            setTimeout(resolve, 10); // engine has 10ms to trigger the event
        }).then(function() {
            if (promiseRejectionEvent) {
                 // to be fully compliant we shoudl ensure
                // promiseRejectionEvent.promise === the promise rejected above
                // but nodejs does not
                if (
                    promiseRejectionEvent.reason === reason &&
                    promiseRejectionEvent.promise === promise
                ) {
                    return pass('event-ok');
                }
                return fail('event-mismatch');
            }
            return fail('event-not-triggered');
        });
    }
};
export {test};

export {solution} from '../feature.js';
