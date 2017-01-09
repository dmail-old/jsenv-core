// https://developer.mozilla.org/en-US/docs/Web/API/Response

import compose from '@jsenv/compose';

import Headers from './headers.js';
import BodyConsumer from './body-consumer.js';
import Body from './body.js';

const Response = compose('Response', BodyConsumer, {
    status: undefined,
    headers: null,
    body: null,
    redirectCount: 0,
    uri: null,

    cacheState: 'none', // 'local', 'validated', 'partial'

    constructor(options) {
        options = options || {};

        Object.assign(this, options);

        this.headers = Headers.create(this.headers);
        if (this.hasOwnProperty('body')) {
            this.body = Body.create(this.body);
        }
    },

    get url() {
        return this.uri.toURL();
    },

    clone() {
        var properties = {};

        Object.getOwnPropertyNames(this).forEach(function(name) {
            properties[name] = this[name];
        }, this);

        if (properties.body) {
            var out = this.body.tee();
            this.body = out[0];
            properties.body = out[1];
        }

        var cloneResponse = this.create(properties);

        return cloneResponse;
    }
});

export default Response;
