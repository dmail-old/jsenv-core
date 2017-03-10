const Timeout = {
    timer: null,
    expirationEffect: 'resolve',

    constructor(value) {
        if (arguments.length > 0) {
            this.set(value);
        }
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    },

    valueOf() {
        return this.value;
    },

    create() {
        var timeout = Object.create(this);

        timeout.constructor.apply(timeout, arguments);

        return timeout;
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
    }
};

export default Timeout;
