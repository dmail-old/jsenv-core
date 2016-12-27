// example of a base64 transformer that could be used by TransformStream

import base64 from 'evn/base64';

import proto from 'proto';

var Base64EncodeTransformer = proto.extend({
    writableStrategy: undefined,
    readableStrategy: undefined,
    // flush(){},
    transform(chunk, write, done) {
        write(base64.encode(chunk));
        done();
    }
});

export default Base64EncodeTransformer;
