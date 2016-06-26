// https://developer.mozilla.org/en-US/docs/Web/API/Request
// ajouter toString & inspect()

import env from 'env';
import proto from 'env/proto';
import objectAPI from 'env/object-clone';

import Headers from './headers.js';
import BodyConsumer from './body-consumer.js';
import Body from './body.js';
// import Response from './response.js';

var defaultOptions = {
    method: 'GET',
    headers: {},
    body: undefined
};

function concatOptions(firstOptions, secondOptions) {
    var options = {};

    Object.keys(defaultOptions).forEach(function(optionName) {
        var firstHasValue = optionName in firstOptions;
        var secondHasValue = optionName in secondOptions;
        var optionValue;

        // in some circumstances we do merge the first & second value
        // in other scenario we just put first or second value
        if (firstHasValue && secondHasValue) {
            if (optionName === 'headers') {
                optionValue = objectAPI.concat(firstOptions[optionName], secondOptions[optionName]);
            } else {
                optionValue = secondOptions[optionName];
            }
        } else if (secondHasValue) {
            optionValue = secondOptions[optionName];
        } else if (firstHasValue) {
            optionValue = firstOptions[optionName];
        }

        options[optionName] = optionValue;
    });

    return options;
}

var Request = proto.extend('Request', BodyConsumer, {
    uri: env.baseURI,
    defaultOptions: defaultOptions,
    concatOptions: concatOptions,

    constructor(uri, options) {
        var argLength = arguments.length;

        if (argLength === 0) {
            throw new Error('Request expect at least one argument');
        } else if (argLength === 1) {
            options = {};
        } else if (argLength > 2) {
            throw new Error('Request expect two arguments or less');
        }

        if (typeof options !== 'object') {
            throw new Error('Request options must be an object');
        }
        this.options = concatOptions(this.defaultOptions, options);

        if (uri !== this.uri) {
            this.uri = env.createURI(uri);
        }
        this.headers = Headers.create();

        Object.keys(this.options).forEach(function(optionName) {
            if ((optionName in this.defaultOptions) === false) {
                throw new Error('unkown request options ' + optionName);
            }

            var optionValue = this.options[optionName];

            if (optionName === 'headers') {
                this.headers.populate(optionValue);
            } else if (optionName === 'body') {
                if (typeof optionValue !== 'undefined') {
                    this.body = Body.create(optionValue);
                }
            } else {
                this[optionName] = optionValue;
            }
        }, this);

        if (this.body && this.method === 'GET' || this.method === 'HEAD') {
            throw new TypeError('bo nody allowed for get/head requests');
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

    clone(options) {
        options = options || {};

        Object.keys(Request.defaultOptions).forEach(function(optionName) {
            if ((optionName in options) === false) {
                var optionValue = this[optionName];
                options[optionName] = optionValue;
            }
        }, this);

        // no need to clone this.uri because we do env.createURI(options.uri) getting a fresh URI object
        // no need to clone this.headers because we do Headers.populate(options.headers) getting a fresh Headers object
        // no need to clone this.body because we do Body.create(options.body) which does this.body.pipeTo() getting a fresh Body object

        var cloneRequest = this.create(this.uri, options);

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
