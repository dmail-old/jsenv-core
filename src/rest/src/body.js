import require from '@node/require';
// import compose from '@jsenv/compose';
import env from '@jsenv/env';

import Stream from './stream/index.js';

var DuplexStream = Stream.Duplex;

var Body = DuplexStream.compose('Body', {
    constructor(body) {
        if (body !== undefined) {
            if (Body.isPrototypeOf(body)) {
                return body;
            }
            this.fill(body);
        }
    },

    fill(data) {
        if (data && data.pipeTo) {
            data.pipeTo(this);
        } else {
            if (data) {
                this.write(String(data));
            }
            this.close();
        }
    },

    readAsString() {
        return this.then(function() {
            return this.buffers.join('');
        }.bind(this));
    }
});

// make it nodejs compatible
if (env.isNode()) {
    var stream = require('stream');
    var isNodeStream = function(a) {
        if (a instanceof stream.Stream || a instanceof stream.Writable) {
            return true;
        }

        return false;
    };

    // var pipeTo = DuplexStream.pipeTo;
    Body.pipeTo = function(item) {
        if (isNodeStream(item)) {
            item.close = item.end;

            var promise = new Promise(function(res, rej) {
                item.on('end', res);
                item.on('error', rej);
            });

            item.then = function(onResolve, onReject) {
                return promise.then(onResolve, onReject);
            };

            item.catch = function(onReject) {
                return promise.catch(onReject);
            };

            item.error = function(e) {
                item.emit('error', e);
            };
        }

        return DuplexStream.pipeTo.call(this, item);
    };

    var fill = Body.fill;
    Body.fill = function(data) {
        // node readable streams
        if (isNodeStream(data)) {
            var passStream = new stream.PassThrough();

            passStream.on('data', this.write.bind(this));
            passStream.on('end', this.close.bind(this));
            data.on('error', this.error.bind(this));

            // pourquoi j'utilise un passtrhough au lieu d'écouter directement les event sdu stream?
            // chais pas, peu importe y'avais surement une bonne raison

            data.pipe(passStream);
        } else {
            fill.call(this, data);
        }
    };
}

export default Body;
