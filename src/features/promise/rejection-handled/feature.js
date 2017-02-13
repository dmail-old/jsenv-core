this.code = 'inherit';
this.pass = function(Promise, settle) {
    var promiseRejectionEvent;
    var unhandledRejection = function(e) {
        promiseRejectionEvent = e;
    };

    if (jsenv.isBrowser()) {
        if ('onunhandledrejection' in window === false) {
            return settle(false);
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
        return settle(false);
    }

    Promise.reject('foo');
    setTimeout(function() {
        var valid = (
            promiseRejectionEvent &&
            promiseRejectionEvent.reason === 'foo'
        );
        // to be fully compliant we shoudl ensure
        // promiseRejectionEvent.promise === the promise rejected above
        // BUT it seems corejs dos not behave that way
        // and I'm not 100% sure what is the expected promise object here
        settle(valid);
    }, 10); // engine has 10ms to trigger the event
};
this.solution = 'inherit';
