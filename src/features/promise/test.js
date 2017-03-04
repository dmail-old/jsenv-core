// https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent
// https://googlechrome.github.io/samples/promise-rejection-events/
import {at, present, listenOnce} from '/test-helpers.js';

const test = {
    run: at('Promise'),
    complete: present,

    children: [
        {
            name: 'unhandled-rejection',
            complete(_, fail, pass) {
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
        },
        {
            name: 'rejection-handled',
            maxDuration: 150,
            complete(_, fail, pass) {
                var promiseRejectionEvent;

                if (jsenv.isBrowser()) {
                    listenOnce('rejectionHandled', function() {
                        promiseRejectionEvent = {
                            reason: event.reason,
                            promise: event.promise
                        };
                    });
                } else if (jsenv.isNode()) {
                    listenOnce('rejectionHandled', function(promise) {
                        promiseRejectionEvent = {
                            promise: promise
                        };
                    });
                } else {
                    return fail('unkown-platform');
                }

                const reason = 'foo';
                const promise = Promise.reject(reason);
                const waitEventDuration = 100; // engine has 100ms to trigger the event
                return new Promise(function(resolve) {
                    setTimeout(
                        function() {
                            promise.catch(function() {});
                            setTimeout(resolve, waitEventDuration);
                        },
                        2
                        // it's important to keep 1 or 2ms here so that this setTimeout
                        // cannot be in concurrency (and be executed before) the one Promise polyfill may use
                    );
                }).then(function() {
                    if (promiseRejectionEvent) {
                        // node event emit only the promise value
                        // so we can't check for
                        // promiseRejectionEvent.reason === reason
                        if (promiseRejectionEvent.promise === promise) {
                            return pass('event-ok');
                        }
                        return fail('event-mismatch');
                    }
                    return fail('event-not-triggered');
                });
            }
        }
    ]
};

export default test;
