// https://streams.spec.whatwg.org/
// https://streams.spec.whatwg.org/#rs-model
// http://jakearchibald.com/2015/thats-so-fetch/

import proto from 'proto';

var DuplexStream = proto.extend('DuplexStream', {
    constructor() {
        this.buffers = [];
        this.length = 0;
        this.pipes = [];
        this.state = 'opened';

        this.promise = new Promise(function(resolve, reject) {
            this.resolve = resolve;
            this.reject = reject;
        }.bind(this));
    },

    pipeTo(stream, options = {}) {
        var preventCancel = Boolean(options.preventCancel);
        var preventClose = Boolean(options.preventClose);
        var preventError = Boolean(options.preventError);

        if (this.state === 'cancelled') {
            if (preventCancel) {
                // throw new Error('stream cancelled : it cannot pipeTo other streams');
                //
            } else {
                stream.cancel();
            }
        } else if (this.state === 'errored') {
            if (preventError) {
                //
            } else {
                stream.error(this.storedError);
            }
        } else {
            this.pipes.push(stream);
            if (this.length) {
                this.buffers.forEach(function(buffer) {
                    stream.write(buffer);
                }, this);
            }

            if (this.state === 'closed') {
                if (preventClose) {
                    //
                } else {
                    stream.close();
                }
            }
        }

        return stream;
    },

    pipeThrough(duplexStream, options) {
        return this.pipeTo(duplexStream, options);
    },

    write(data) {
        this.buffers.push(data);
        this.length += data.length;

        this.pipes.forEach(function(pipe) {
            pipe.write(data);
        });
    },

    error(e) {
        this.state = 'errored';
        this.storedError = e;
        this.pipes.forEach(function(pipe) {
            pipe.error(e);
        });
        this.reject(e);
    },

    close() {
        this.pipes.forEach(function(pipe) {
            if (pipe.close) {
                pipe.close();
            }
        });
        this.pipes.length = 0;
        this.state = 'closed';
        this.resolve();
    },

    cancel() {
        this.close();
        this.buffers.length = 0;
        this.length = 0;
        this.state = 'cancelled';
    },

    tee() {
        var a = this;
        var b = this.create();

        this.pipeTo(b);

        return [
            a,
            b
        ];
    },

    then(a, b) {
        return this.promise.then(a, b);
    },

    catch(a) {
        return this.then(null, a);
    }
});

// duplexstream is a simplified concept of a readable & writable stream
export const test = {
    modules: ['@node/assert'],

    main() {
        this.skip('test must be rewritten');

        this.add("resolved with close()", function(test) {
            var streamA = DuplexStream.create();
            var streamB = DuplexStream.create();

            streamA.close();
            return Promise.all([
                test.willResolve(streamA),
                test.willTimeout(streamB)
            ]);
        });

        this.add("rejected by error()", function(test) {
            var streamA = DuplexStream.create();

            streamA.error('error');
            return test.rejectWith(streamA, 'error');
        });

        this.add("pipeTo call write(), error() & close() of the supplied arg", function(test) {
            var streamA = DuplexStream.create();
            var streamB = DuplexStream.create();
            var streamC = DuplexStream.create();

            var itemA = {
                write: test.spy()
            };
            var itemB = {
                close: test.spy()
            };
            var itemC = {
                error: test.spy()
            };

            streamA.write('hello');
            streamB.close();
            streamC.error('error');
            streamC.catch(function() {}); // handle

            streamA.pipeTo(itemA);
            streamB.pipeTo(itemB);
            streamC.pipeTo(itemC);

            return Promise.all([
                test.calledWith(itemA.write, 'hello'),
                test.calledWith(itemB.close),
                test.calledWith(itemC.error, 'error')
            ]);
        });

        this.add("pipeTo remembers previously written data & write them back", function(test) {
            var streamA = DuplexStream.create();
            var streamB = DuplexStream.create();

            streamA.write('yo');
            streamA.pipeTo(streamB);
            streamA.close();

            return test.resolveWith(streamB.then(function() {
                return streamB.buffers.join('');
            }), 'yo');
        });
    }
};

export default DuplexStream;
