function createThenableFromFunctionCall(fn, bind, args) {
    try {
        var result = fn.apply(bind, args);
        return Promise.resolve(result);
    } catch (e) {
        return Promise.reject(e);
    }
}

export default createThenableFromFunctionCall;
