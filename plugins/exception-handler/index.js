/* eslint-env browser, node */

// import engine from 'engine';

/*
// wait 1000ms before throwing any error
jsenv.exceptionHandler.add(function(e){
    return new Promise(function(res, rej){ setTimeout(function(){ rej(e); }, 1000); });
});
// do not throw error with code itsok
jsenv.exceptionHandler.add(function(e){
    return e && e instanceof Error && e.code === 'itsok' ? undefined : Promise.reject(e);
});
*/

let exceptionHandler = {
    handlers: [],
    handledException: undefined,
    pendingExceptions: [],

    add(exceptionHandler) {
        this.handlers.push(exceptionHandler);
    },

    throw(value) {
        throw value;
    },

    createException(value) {
        var exception = new Exception(value);
        return exception;
    },

    handleException(exception) {
        if (this.handledException) {
            exception.pending = true;
            this.pendingExceptions.push(exception);
        } else {
            this.handledException = exception;
            exception.attemptToRecover().then(function(recovered) {
                if (recovered) {
                    exceptionHandler.handledException = undefined;
                    if (exceptionHandler.pendingExceptions.length) {
                        var pendingException = exceptionHandler.pendingExceptions.shift();
                        pendingException.raise(); // now try to recover this one
                    }
                } else {
                    // put in a timeout to prevent promise from catching this exception
                    setTimeout(function() {
                        exception.crash();
                    });
                }
            });
        }

        return exception;
    },

    handleError(error) {
        var exception;

        exception = exceptionHandler.createException(error);

        return exceptionHandler.handleException(exception);
    },

    handleRejection(rejectedValue, promise) {
        if (rejectedValue instanceof Exception) {
            return rejectedValue;
        }

        var exception;

        exception = exceptionHandler.createException(rejectedValue);
        exception.promise = promise;

        return exceptionHandler.handleException(exception);
    },

    markPromiseAsHandled(promise) {
        var handledException = this.handledException;

        if (handledException) {
            if (handledException.isComingFromPromise(promise)) {
                handledException.recover();
            } else {
                var pendings = this.pendingExceptions;
                var i = pendings.length;
                while (i--) {
                    var exception = pendings[i];
                    if (exception.isComingFromPromise(promise)) {
                        exception.recover();
                        break;
                    }
                }
            }
        }
    }
};

function Exception(value) {
    if (value instanceof Exception) {
        return value;
    }
    this.value = value;
    this.recoveredPromise = new Promise(function(resolve) {
        this.resolve = resolve;
    }.bind(this));
}

Exception.prototype = {
    promise: undefined,
    settled: false,
    recovered: false,
    meta: undefined, // cusom meta, put whatever you want

    isRejection() {
        return this.hasOwnProperty('promise');
    },

    isComingFromPromise(promise) {
        return this.isRejection() && this.promise === promise;
    },

    attemptToRecover() {
        var exception = this;
        var index = 0;
        var handlers = exceptionHandler.handlers.slice();
        var nextHandler = function() {
            var promise;

            if (exception.settled) {
                promise = Promise.resolve(this.recovered);
            } else if (index < handlers.length) {
                var handler = handlers[index];
                index++;

                promise = new Promise(function(resolve) {
                    resolve(handler(exception.value, exception));
                }).then(
                    function() {
                        return true;
                    },
                    function(rejectionValue) {
                        if (rejectionValue === exception.value) {
                            return nextHandler();
                        }
                        // an error occured during exception handling, log it and consider exception as not recovered
                        console.error(
                            'the following occurred during exception handling : ',
                            rejectionValue
                        );
                        return false;
                    }
                );
            } else {
                promise = Promise.resolve(false);
            }

            return promise;
        };

        // let handler make exception recover or propagate
        nextHandler().then(function(recovered) {
            if (recovered) {
                exception.recover();
            } else {
                exception.propagate();
            }
        });

        return exception.recoveredPromise;
    },

    recover() {
        if (this.settled === false) {
            if (this.pending) {
                exceptionHandler.pendingExceptions.splice(exceptionHandler.pendingExceptions.indexOf(this), 1);
            }
            this.settled = true;
            this.recovered = true;
            this.resolve(true);
        }
    },

    propagate() {
        if (this.settled === false) {
            this.settled = true;
            this.recovered = false;
            this.resolve(false);
        }
    },

    crash() {
        // disableHooks to prevent hook from catching this error
        // because the following creates an infinite loop (and is what we're doing)
        // process.on('uncaughtException', function() {
        //     setTimeout(function() {
        //         throw 'yo';
        //     });
        // });
        // we have to ignore exception thrown while we are throwing, we could detect if the exception differs
        // which can happens if when doing throw new Error(); an other error occurs
        // -> may happen for instance if accessing error.stack throw an other error
        exceptionHandler.disable();
        exceptionHandler.throw(this.value);
        // enabledHooks in case throwing error did not terminate js execution
        // in the browser or if external code is listening for process.on('uncaughException');
        exceptionHandler.enable();
    },

    raise() {
        return exceptionHandler.handleException(this);
    }
};

exceptionHandler.install = function(jsenv) {
    function catchError(error) {
        return exceptionHandler.handleError(error);
    }

    function unhandledRejection(value, promise) {
        return exceptionHandler.handleRejection(value, promise);
    }

    function rejectionHandled(promise) {
        return exceptionHandler.markPromiseAsHandled(promise);
    }

    var enableHooks;
    var disableHooks;
    if (jsenv.isBrowser()) {
        enableHooks = function() {
            window.onunhandledrejection = function(e) {
                unhandledRejection(e.reason, e.promise);
            };
            window.onrejectionhandled = function(e) {
                rejectionHandled(e.promise);
            };
            window.onerror = function(errorMsg, url, lineNumber, column, error) {
                catchError(error);
            };
        };
        disableHooks = function() {
            window.onunhandledrejection = undefined;
            window.onrejectionhandled = undefined;
            window.onerror = undefined;
        };
    } else if (jsenv.isNode()) {
        enableHooks = function() {
            process.on('unhandledRejection', unhandledRejection);
            process.on('rejectionHandled', rejectionHandled);
            process.on('uncaughtException', catchError);
        };
        disableHooks = function() {
            process.removeListener('unhandledRejection', unhandledRejection);
            process.removeListener('rejectionHandled', rejectionHandled);
            process.removeListener('uncaughtException', catchError);
        };
    }

    exceptionHandler.enable = function() {
        enableHooks();
    };

    exceptionHandler.disable = function() {
        disableHooks();
    };

    jsenv.exceptionHandler = exceptionHandler;
};

export default exceptionHandler;
