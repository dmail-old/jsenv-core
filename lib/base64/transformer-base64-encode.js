// example of a base64 transformer that could be used by TransformStream

import base64 from '@jsenv/base64';
import compose from '@jsenv/compose';

var Base64EncodeTransformer = compose({
    writableStrategy: undefined,
    readableStrategy: undefined,
    // flush(){},
    transform(chunk, write, done) {
        write(base64.encode(chunk));
        done();
    }
});

export default Base64EncodeTransformer;
