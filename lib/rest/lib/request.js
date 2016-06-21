// https://developer.mozilla.org/en-US/docs/Web/API/Request
// ajouter toString & inspect()

import env from 'env';
import proto from 'env/proto';

import Headers from './headers.js';
import BodyConsumer from './body-consumer.js';
import Body from './body.js';
// import Response from './response.js';

var RequestOptions = {
    method: 'GET',
    uri: env.baseURI,
    headers: Headers.create(),
    body: undefined,

    redirectMode: 'follow', // 'error', 'manual'
    cacheMode: 'default' // 'no-store', 'reload', 'no-cache', 'force-cache', 'only-if-cached'
};

var Request = proto.extend('Request', RequestOptions, BodyConsumer, {
    constructor() {
        var options;
        if (arguments.length === 0) {
            options = {};
        } else if (arguments.length === 1) {
            options = arguments[0];

            if (typeof options === 'string') {
                options = {uri: options};
            } else if (typeof options !== 'object') {
                throw new Error('Request first argument must be an object');
            }

            if (Request.isPrototypeOf(options)) {
                return options;
            }
        } else {
            throw new Error('Request expect zero or one argument');
        }

        Object.keys(options).forEach(function(optionName) {
            if ((optionName in RequestOptions) === false) {
                throw new Error('unkown request options ' + optionName);
            }

            var optionValue = options[optionName];

            if (optionName === 'uri') {
                optionValue = this.uri.resolve(optionValue);
            } else if (optionName === 'headers') {
                optionValue = Headers.create(optionValue);
            } else if (optionName === 'body') {
                optionValue = Body.create(optionValue);
            }

            this[optionName] = optionValue;
        }, this);

        if (('headers' in options) === false) {
            this.headers = this.headers.clone();
        }
        if (('uri' in options) === false) {
            this.uri = this.uri.clone();
        }
        if (('body' in options) && typeof options.body !== 'undefined') {
            if (this.method === 'GET' || this.method === 'HEAD') {
                throw new TypeError('bo nody allowed for get/head requests');
            }

            /*
            if( this.headers.get('content-type') == 'application/json' ){
                if( typeof this.body === 'object' ) this.body = JSON.stringify(this.body);
            }
            */
        }
    },

    get url() {
        return this.uri.toURL();
    },

    clone() {
        var properties = {};

        Object.keys(RequestOptions).forEach(function(optionName) {
            var optionValue = this[optionName];
            properties[optionName] = optionValue;
        }, this);

        // no need to clone this.uri because we do this.uri.resolve(properties.uri) getting a fresh URI object
        // no need to clone this.headers because we do Headers.create(this.headers) getting a fresh Headers object
        // no need to clone this.body because we do Body.create(this.body) which does this.body.pipeTo() getting a fresh Body object

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
