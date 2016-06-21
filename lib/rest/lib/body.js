import env from 'env';
import proto from 'env/proto';

import require from '@node/require'; // remove this asap

import Stream from '../../stream/index.js';

var DuplexStream = Stream.Duplex;

var Body = proto.extend.call(DuplexStream, 'Body', {
    constructor(body) {
        Body.super.constructor.call(this);

        if (body !== undefined) {
            // if (Body.isPrototypeOf(body)) {
            //     return body;
            // }
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

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        this.add("fill(pipable) calls pipable.pipeTo(this)", function() {
            var body = Body.create();
            var called = false;
            var item = {pipeTo: function() {
                called = true;
            }};

            body.fill(item);

            assert.equal(called, true);
        });

        this.add("fill(notundefined) write into body and close it", function() {
            var body = Body.create();

            body.fill('yo');

            assert.equal(body.state, 'closed');

            return body.readAsString().then(function(data) {
                assert.equal(data, 'yo');
            });
        });

        this.add({
            name: "pipeTo(nodeStream) wrap the nodestream to give him close(),then(),catch(),error() methods",
            modules: ['@node/stream'],
            main: function(nodeStream) {
                var body = Body.create();
                var streamA = new nodeStream.PassThrough();

                body.pipeTo(streamA);

                assert.equal(typeof streamA.close, 'function');
                assert.equal(typeof streamA.then, 'function');
                assert.equal(typeof streamA.catch, 'function');
                assert.equal(typeof streamA.error, 'function');

                streamA.error('foo');

                return streamA.then(
                    function(value) {
                        assert.fail('resolved with ' + value, 'rejected with foo');
                    },
                    function(error) {
                        assert.equal(error, 'foo');
                    }
                );
            }
        });

        this.add("fill(undefined) close without data", function() {
            var body = Body.create();

            body.fill(undefined);

            return body.readAsString().then(function(data) {
                assert.equal(data, '');
            });
        });

        this.add("on creation, argument[0] !== undefined is passed to fill()", function() {
            var body = Body.create('foo');

            return body.readAsString().then(function(data) {
                assert.equal(data, 'foo');
            });
        });

        this.add("readAsString is resolved to the stream buffers as string", function() {

        }).skip();
    }
};
