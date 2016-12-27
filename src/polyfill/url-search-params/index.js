// https://github.com/WebReflection/url-search-params/tree/master/src

import jsenv from 'jsenv';

var replace = {
    '!': '%21',
    "'": '%27',
    '(': '%28',
    ')': '%29',
    '~': '%7E',
    '%20': '+',
    '%00': '\x00'
};

function replacer(match) {
    return replace[match];
}

function encode(str) {
    return encodeURIComponent(str).replace(/[!'\(\)~]|%20|%00/g, replacer);
}

function decode(str) {
    return decodeURIComponent(str.replace(/\+/g, ' '));
}

let URLSearchParams = {
    constructor(queryString) {
        this.fromString(queryString);
    },

    fromString(queryString) {
        this.params = {};

        if (queryString) {
            var index;
            var value;
            var pairs = queryString.split('&');
            var i = 0;
            var length = pairs.length;

            for (;i < length; i++) {
                value = pairs[i];
                index = value.indexOf('=');
                if (index > -1) {
                    this.append(
                        decode(value.slice(0, index)),
                        decode(value.slice(index + 1))
                    );
                }
            }
        }
    },

    append(name, value) {
        var params = this.params;

        value = String(value);
        if (name in params) {
            params[name].push(value);
        } else {
            params[name] = [value];
        }
    },

    delete(name) {
        delete this.params[name];
    },

    get(name) {
        var params = this.params;
        return name in params ? params[name][0] : null;
    },

    getAll(name) {
        var params = this.params;
        return name in params ? params[name].slice(0) : [];
    },

    has(name) {
        return name in this.params;
    },

    set(name, value) {
        value = String(value);
        this.params[name] = [value];
    },

    toJSON() {
        return {};
    },

    toString() {
        var params = this.params;
        var query = [];
        var key;
        var name;
        var i;
        var value;
        var j;

        for (key in params) { // eslint-disable-line
            name = encode(key);
            i = 0;
            value = params[key];
            j = value.length;

            for (;i < j; i++) {
                query.push(name + '=' + encode(value[i]));
            }
        }

        return query.join('&');
    }
};

URLSearchParams.constructor.prototype = URLSearchParams;
URLSearchParams = URLSearchParams.constructor;

if (('URLSearchParams' in jsenv.global) === false) {
    jsenv.global.URLSearchParams = URLSearchParams;
}

export default URLSearchParams;
