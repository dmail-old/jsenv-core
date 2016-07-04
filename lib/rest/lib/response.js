// https://developer.mozilla.org/en-US/docs/Web/API/Response

import URI from 'env/uri';
import proto from 'env/proto';

import Headers from './headers.js';
import BodyConsumer from './body-consumer.js';
import Body from './body.js';

const defaultOptions = {
    status: undefined,
    headers: {},
    body: undefined
};

const Response = proto.extend('Response', BodyConsumer, {
    defaultOptions: defaultOptions,

    constructor(uri, options) {
        var argLength = arguments.length;
        if (argLength === 0) {
            throw new Error('Response expect at least one argument');
        } else if (argLength === 1) {
            options = {};
        } else if (argLength > 2) {
            throw new Error('Response expect two arguments or less');
        }
        if (typeof options !== 'object') {
            throw new Error('Request options must be an object');
        }
        this.options = options;
        if (uri !== this.uri) {
            this.uri = URI.create(uri);
        }
        this.headers = Headers.create();

        Object.keys(this.options).forEach(function(optionName) {
            if ((optionName in this.defaultOptions) === false) {
                throw new Error('unkown response options ' + optionName);
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
    },

    get url() {
        return this.uri.toURL();
    },

    clone(uri, options) {
        uri = uri || this.uri;
        options = options || {};

        Object.keys(Response.defaultOptions).forEach(function(optionName) {
            if ((optionName in options) === false) {
                var optionValue = this[optionName];
                options[optionName] = optionValue;
            }
        }, this);

        var cloneResponse = this.create(uri, options);

        return cloneResponse;
    }
});

export default Response;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add('headers options', function() {
            var response = Response.create('', {
                headers: {
                    'content-length': 10
                }
            });

            assert.equal(response.headers.get('content-length'), 10);
        });

        this.add('headers clone', function() {
            var response = Response.create('', {
                headers: {
                    'content-length': 10
                }
            });

            var clonedResponse = response.clone();

            assert.equal(clonedResponse.headers.has('content-length'), true);
            assert.equal(clonedResponse.headers.get('content-length'), 10);
        });
    }
};
