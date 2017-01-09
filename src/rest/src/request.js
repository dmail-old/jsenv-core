// https://developer.mozilla.org/en-US/docs/Web/API/Request
// ajouter toString & inspect()

import env from '@jsenv/env';
import compose from '@jsenv/compose';

import Headers from './headers.js';
import BodyConsumer from './body-consumer.js';
import Body from './body.js';
// import Response from './response.js';

var Request = compose('Request', BodyConsumer, {
    baseURI: env.baseURI,
    method: 'GET',
    uri: null,
    headers: {},
    body: null,

    redirectMode: 'follow', // 'error', 'manual'
    cacheMode: 'default', // 'no-store', 'reload', 'no-cache', 'force-cache', 'only-if-cached'

    constructor(options = {}) {
        if (Request.isPrototypeOf(options)) {
            return options;
        }

        if (options.headers) {
            options.headers = Object.assign({}, this.headers, options.headers);
        }

        Object.assign(this, options);

        if (!this.uri) {
            this.uri = this.baseURI.clone();
        }

        this.uri = this.baseURI.resolve(this.uri);
        this.headers = Headers.create(this.headers);

        if (this.hasOwnProperty('body')) {
            if (this.method === 'GET' || this.method === 'HEAD') {
                throw new TypeError('bo nody allowed for get/head requests');
            }
            /*
            if( this.headers.get('content-type') == 'application/json' ){
                if( typeof this.body === 'object' ) this.body = JSON.stringify(this.body);
            }
            */

            this.body = Body.create(this.body);
        }
    },

    get url() {
        return this.uri.toURL();
    },

    clone() {
        var properties = {};

        Object.getOwnPropertyNames(this).forEach(function(property) {
            properties[property] = this[property];
        }, this);

        if (this.body) {
            var out = this.body.tee();
            this.body = out[0];
            properties.body = out[1];
        }
        if (this.headers) {
            properties.headers = this.headers.toJSON();
        }
        if (this.uri) {
            properties.uri = this.uri.clone();
        }

        var cloneRequest = this.create(properties);

        return cloneRequest;
    }
});

export const test = {
    modules: ['@node/assert'],

    main() {
        // body not allowed for get/head
        // headers
        // locate
        // baseURL is resolved from Request.baseURI
        // url is resolved from Request.baseURL
    }
};

export default Request;
