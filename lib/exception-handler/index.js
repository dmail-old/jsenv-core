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

import proto from 'jsenv/proto';

const Exception = proto.extend('Exception', {
    promise: undefined,
    meta: undefined, // cusom meta, put whatever you want

    constructor(value) {
        if (Exception.isPrototypeOf(value)) {
            return value;
        }
        this.value = value;
        // this.recoveredPromise = new Promise(function(resolve) {
        //     this.resolve = resolve;
        // }.bind(this));
    },

    isRejection() {
        return this.hasOwnProperty('promise');
    },

    isComingFromPromise(promise) {
        return this.isRejection() && this.promise === promise;
    }
});

const ExceptionHandler = proto.extend('ExceptionHandler', {
    constructor() {
        this.handlers = [];
        this.handledException = undefined;
        this.pendingExceptions = [];
    },

    install(env) {
        var exceptionHandler = this.create();

        function catchError(error) {
            return exceptionHandler.handleError(error);
        }
        catchError.env = env;

        function unhandledRejection(value, promise) {
            return exceptionHandler.handleRejection(value, promise);
        }

        function rejectionHandled(promise) {
            return exceptionHandler.markPromiseAsHandled(promise);
        }

        var enableHooks;
        var disableHooks;
        if (env.isBrowser()) {
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
        } else if (env.isNode()) {
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

        exceptionHandler.enable();

        env.exceptionHandler = exceptionHandler;
        this.env = env;
    },

    add(handler) {
        this.handlers.push(handler);
    },

    throw(value) {
        throw value;
    },

    createException(value) {
        var exception = Exception.create(value);
        return exception;
    },

    attemptToRecover(exception) {
        var index = 0;
        var handlers = this.handlers.slice(); // any handler added during recover is ignored thanks to this line
        var self = this;
        var nextHandler = function() {
            var promise;

            if (index < handlers.length) {
                var handler = handlers[index];
                index++;

                promise = new Promise(function(resolve) {
                    resolve(handler.call(self, exception.value, exception));
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

        var manualRecoverStatusPromise = new Promise(function(resolve, reject) {
            this.recoverAttempt = {
                resolve: resolve,
                reject: reject
            };
        }.bind(this));

        var handlerRecoverStatusPromise = nextHandler();

        return Promise.race([
            handlerRecoverStatusPromise,
            manualRecoverStatusPromise
        ]);
    },

    handleException(exception) {
        // exception.handler = this;
        if (this.handledException) {
            this.pendingExceptions.push(exception);
        } else {
            this.handledException = exception;
            this.attemptToRecover(exception).then(function(recovered) {
                this.pendingExceptions.splice(this.pendingExceptions.indexOf(exception), 1);

                if (recovered) {
                    this.handledException = undefined;
                    if (this.pendingExceptions.length) {
                        var pendingException = this.pendingExceptions.shift();
                        this.handleException(pendingException); // now try to recover this one
                    }
                } else {
                    // put in a timeout to prevent promise from catching this exception
                    setTimeout(function() {
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
                        console.log('disable exception handling for', this.env.id);
                        this.disable();
                        // there is still on uncaughtException on global env, which will catch the exception and because of this will
                        // retry to recover the exception, it's not a problem except that only parent should be allowed to recover the exception
                        // child must not have a chance to recatch the same exception again, for now just disable the hooks
                        console.log('throw on', this.env.id);
                        this.throw(exception.value);

                        // enabledHooks in case throwing error did not terminate js execution
                        // in the browser or if external code is listening for process.on('uncaughException');
                        // this.enable();
                    }.bind(this));
                }
            }.bind(this));
        }

        return exception;
    },

    handleError(error) {
        var exception;

        exception = this.createException(error);

        return this.handleException(exception);
    },

    handleRejection(rejectedValue, promise) {
        if (Exception.isPrototypeOf(rejectedValue)) {
            return rejectedValue;
        }

        var exception;

        exception = this.createException(rejectedValue);
        exception.promise = promise;

        return this.handleException(exception);
    },

    recover(exception) {
        // if exception is being recovered, cancel it and consider as recovered
        // if the exception was pending to be recovered just remove it from the list

        if (this.handledException === exception) {
            this.recoverAttempt.resolve(true);
        } else if (this.pendingExceptions.includes(exception)) {
            this.pendingExceptions.splice(this.pendingExceptions.indexOf(exception), 1);
        }
    },

    markPromiseAsHandled(promise) {
        // à refaire puisque pas géé pour le moment
        var handledException = this.handledException;

        if (handledException) {
            if (handledException.isComingFromPromise(promise)) {
                this.recover(handledException);
            } else {
                var pendings = this.pendingExceptions;
                var i = pendings.length;
                while (i--) {
                    var exception = pendings[i];
                    if (exception.isComingFromPromise(promise)) {
                        this.recover(exception);
                        break;
                    }
                }
            }
        }
    }
});

export default ExceptionHandler;
