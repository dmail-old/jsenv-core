import {expect} from 'helper/detect.js';
import parent from '../feature.js';
const feature = {
    dependencies: [parent],
    run: parent.run,
    maxTestDuration: 150,
    test: expect(function(Promise, fail, pass) {
        var promiseRejectionEvent;

        if (jsenv.isBrowser()) {
            if ('onrejectionhandled' in window === false) {
                return fail('missing-window-onrejectionhandled');
            }
            var browserListener = function(event) {
                window.removeEventListener('rejectionhandled', browserListener);
                promiseRejectionEvent = event;
            };
            window.addEventListener('rejectionhandled', browserListener);
        } else if (jsenv.isNode()) {
            var nodeListener = function(promise) {
                process.removeListener('rejectionHandled', nodeListener);
                promiseRejectionEvent = {promise: promise};
            };
            process.addListener('rejectionHandled', nodeListener);
        } else {
            return fail('unkown-platform');
        }

        var promise = Promise.reject('foo');
        return new Promise(function(resolve) {
            setTimeout(function() {
                promise.catch(function() {});
                // engine has 10ms to trigger the event
                setTimeout(resolve, 100);
            }, 2);
        }).then(function() {
            if (promiseRejectionEvent) {
                // node event emit the value
                // so we can't check for
                // promiseRejectionEvent.reason === 'foo'
                if (promiseRejectionEvent.promise === promise) {
                    return pass('event-ok');
                }
                return fail('event-promise-mismatch');
            }
            return fail('event-not-triggered');
        });
    }),
    solution: parent.solution
};
export default feature;
