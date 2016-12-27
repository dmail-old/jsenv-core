var Timeout = {
    timer: null,
    expirationEffect: 'resolve',

    constructor: function(value) {
        if (arguments.length > 0) {
            this.set(value);
        }
        this.promise = new Promise(function(resolve, reject) {
            this.resolve = resolve;
            this.reject = reject;
        }.bind(this));
    },

    valueOf: function() {
        return this.value;
    },

    create: function() {
        var timeout = Object.create(this);

        timeout.constructor.apply(timeout, arguments);

        return timeout;
    },

    turnExpirationIntoRejection: function() {
        this.expirationEffect = 'reject';
    },

    expire: function() {
        this[this.expirationEffect](this);
    },

    has: function() {
        return this.timer !== null;
    },

    get: function() {
        return this.value;
    },

    set: function(value) {
        this.clear();
        this.value = value;
        if (value > -1) {
            this.timer = setTimeout(this.expire.bind(this), value);
        }
    },

    clear: function() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    },

    then: function(onResolve, onReject) {
        return this.promise.then(onResolve, onReject);
    },

    catch: function(onReject) {
        return this.then(null, onReject);
    }
};

export default Timeout;
