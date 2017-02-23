expose(
    {
        maxTestDuration: 150,
        pass: function(output, settle) {
            var Promise = output.value;
            var promiseRejectionEvent;

            if (jsenv.isBrowser()) {
                if ('onrejectionhandled' in window === false) {
                    return settle(false, 'missing-window-onrejectionhandled');
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
                return settle(false, 'unkown-platform');
            }

            var promise = Promise.reject('foo');
            setTimeout(function() {
                promise.catch(function() {});
                setTimeout(function() {
                    if (promiseRejectionEvent) {
                        if (promiseRejectionEvent.promise === promise) {
                            settle(true, 'event-ok');
                        } else {
                            settle(false, 'event-promise-mismatch');
                        }
                    } else {
                        settle(false, 'event-not-triggered');
                    }
                    // node event emit the value
                    // so we can't check for
                    // promiseRejectionEvent.reason === 'foo'
                }, 100); // engine has 500ms to trigger the event
            }, 2);
        }
    }
);
