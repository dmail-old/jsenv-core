/*
https://developer.mozilla.org/en-US/docs/Web/API/Headers
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/

import proto from 'env/proto';

function normalizeName(headerName) {
    headerName = String(headerName);
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(headerName)) {
        throw new TypeError('Invalid character in header field name');
    }

    return headerName.toLowerCase();
}

function normalizeValue(headerValue) {
    return String(headerValue);
}

// https://gist.github.com/mmazer/5404301
function parseHeaders(headerString) {
    var headers = {};
    var pairs;
    var pair;
    var index;
    var i;
    var j;
    var key;
    var value;

    if (headerString) {
        pairs = headerString.split('\r\n');
        i = 0;
        j = pairs.length;
        for (;i < j; i++) {
            pair = pairs[i];
            index = pair.indexOf(': ');
            if (index > 0) {
                key = pair.slice(0, index);
                value = pair.slice(index + 2);
                headers[key] = value;
            }
        }
    }

    return headers;
}

function checkImmutability(headers) {
    if (headers.guard === 'immutable') {
        throw new TypeError('headers are immutable');
    }
}

const Headers = proto.extend('Headers', {
    constructor(headers) {
        this.guard = 'none'; // immutable
        this.map = new Map();

        if (headers) {
            this.populate(headers);
        }
    },

    clone() {
        return Headers.create(this);
    },

    populate(headers) {
        if (typeof headers === 'string') {
            headers = parseHeaders(headers);
        }

        if (Headers.isPrototypeOf(headers)) {
            headers.forEach(this.append, this);
        } else if (Symbol.iterator in headers) {
            for (let header of headers) {
                this.append(header[0], header[1]);
            }
        } else if (typeof headers === 'object') {
            for (let name in headers) { // eslint-disable-line guard-for-in
                this.append(name, headers[name]);
            }
        }
    },

    has(name) {
        name = normalizeName(name);
        return this.map.has(name);
    },

    get(name) {
        name = normalizeName(name);
        return this.map.has(name) ? this.map.get(name)[0] : null;
    },

    getAll(name) {
        name = normalizeName(name);
        return this.map.has(name) ? this.map.get(name) : [];
    },

    set(name, value) {
        checkImmutability(this);

        name = normalizeName(name);
        value = normalizeValue(value);
        this.map.set(name, [value]);
    },

    append(name, value) {
        checkImmutability(this);

        name = normalizeName(name);
        value = normalizeValue(value);

        var values;

        if (this.map.has(name)) {
            values = this.map.get(name);
        } else {
            values = [];
        }

        values.push(value);
        this.map.set(name, values);
    },

    combine(name, value) {
        if (this.map.has(name)) {
            value = ', ' + normalizeValue(value);
        }

        return this.append(name, value);
    },

    delete(name) {
        checkImmutability(this);

        name = normalizeName(name);
        return this.map.delete(name);
    },

    [Symbol.iterator]() {
        return this.map[Symbol.iterator]();
    },

    entries() {
        return this.map.entries();
    },

    keys() {
        return this.map.keys();
    },

    values() {
        return this.map.values();
    },

    forEach(fn, bind) {
        for (let [headerName, headerValues] of this) {
            headerValues.forEach(function(headerValue) {
                fn.call(bind, headerName, headerValue);
            });
        }
    },

    toString() {
        var headers = [];

        for (let [headerName, headerValues] of this) {
            headers.push(headerName + ': ' + headerValues.join());
        }

        return headers.join('\r\n');
    },

    toJSON() {
        var headers = {};

        for (let [headerName, headerValues] of this) {
            headers[headerName] = headerValues;
        }

        return headers;
    }
});

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add("create with headers", function() {
            var headers = {
                'content-length': 10
            };

            var headersA = Headers.create(headers);
            var headersB = Headers.create(headersA);

            assert.equal(headersB.has('content-length'), true);
        });

        this.add("toJSON", function() {
            var headers = {
                foo: ['foo', 'bar']
            };

            assert.deepEqual(Headers.create(headers).toJSON(), {foo: ['foo,bar']});
        });

        this.add("get", function() {
            var headersMap = {
                foo: 'bar'
            };
            var headers = Headers.create(headersMap);

            assert.equal(headers.get('foo'), 'bar');
        });
    }
};

export default Headers;
