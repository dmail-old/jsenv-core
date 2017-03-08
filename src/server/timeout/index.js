var Timeout = {
    timer: null,
    expirationEffect: 'resolve',

    constructor(value) {
        if (arguments.length > 0) {
            this.set(value);
        }
        this.promise = new Promise(function(resolve, reject) {
            this.resolve = resolve;
            this.reject = reject;
        }.bind(this));
    },

    valueOf() {
        return this.value;
    },

    create() {
        var timeout = Object.create(this);

        timeout.constructor.apply(timeout, arguments);

        return timeout;
    },

    turnExpirationIntoRejection() {
        this.expirationEffect = 'reject';
    },

    expire() {
        this[this.expirationEffect](this);
    },

    has() {
        return this.timer !== null;
    },

    get() {
        return this.value;
    },

    set(value) {
        this.clear();
        this.value = value;
        if (value > -1) {
            this.timer = setTimeout(this.expire.bind(this), value);
        }
    },

    clear() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    },

    then(onResolve, onReject) {
        return this.promise.then(onResolve, onReject);
    },

    catch(onReject) {
        return this.then(null, onReject);
    }
};

export default Timeout;
