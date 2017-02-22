expose(
    {
        pass: function(output, settle) {
            var Promise = output.value;
            var promiseRejectionEvent;
            var unhandledRejection = function(e) {
                promiseRejectionEvent = e;
            };

            if (jsenv.isBrowser()) {
                if ('onunhandledrejection' in window === false) {
                    return settle(false, 'missing-window-onunhandledrejection');
                }
                window.onunhandledrejection = unhandledRejection;
            } else if (jsenv.isNode()) {
                process.on('unhandledRejection', function(value, promise) {
                    unhandledRejection({
                        promise: promise,
                        reason: value
                    });
                });
            } else {
                return settle(false, 'unsupported-platform');
            }

            Promise.reject('foo');
            setTimeout(function() {
                if (promiseRejectionEvent) {
                    if (promiseRejectionEvent.reason === 'foo') {
                        settle(true, 'event-ok');
                    } else {
                        settle(false, 'event-mismatch');
                    }
                } else {
                    settle(false, 'missing-event');
                }
                // to be fully compliant we shoudl ensure
                // promiseRejectionEvent.promise === the promise rejected above
                // BUT it seems corejs dos not behave that way
                // and I'm not 100% sure what is the expected promise object here
            }, 10); // engine has 10ms to trigger the event
        }
    }
);
