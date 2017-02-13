this.code = 'inherit';
this.maxTestDuration = 1000;
this.pass = function(Promise, settle) {
    var promiseRejectionEvent;
    var rejectionHandled = function(e) {
        promiseRejectionEvent = e;
    };

    if (jsenv.isBrowser()) {
        if ('onrejectionhandled' in window === false) {
            return settle(false);
        }
        window.onrejectionhandled = rejectionHandled;
    } else if (jsenv.isNode()) {
        process.on('rejectionHandled', function(promise) {
            rejectionHandled({promise: promise});
        });
    } else {
        return settle(false);
    }

    var promise = Promise.reject('foo');
    setTimeout(function() {
        promise.catch(function() {});
        setTimeout(function() {
            settle(
                promiseRejectionEvent &&
                promiseRejectionEvent.promise === promise
            );
            // node event emit the value
            // so we can't check for
            // promiseRejectionEvent.reason === 'foo'
        }, 500); // engine has 10ms to trigger the event
    });
};
this.solution = 'inherit';
