expose(
    {
        maxTestDuration: 1000,
        pass: function(output, settle) {
            var Promise = output.value;
            var promiseRejectionEvent;
            var rejectionHandled = function(e) {
                promiseRejectionEvent = e;
            };

            if (jsenv.isBrowser()) {
                if ('onrejectionhandled' in window === false) {
                    return settle(false, 'missing-window-onrejectionhandled');
                }
                window.onrejectionhandled = rejectionHandled;
            } else if (jsenv.isNode()) {
                process.on('rejectionHandled', function(promise) {
                    rejectionHandled({promise: promise});
                });
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
                }, 500); // engine has 10ms to trigger the event
            });
        }
    }
);
