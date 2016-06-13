// example of a base64 transformer that could be used by TransformStream

import Base64 from './base64.js';

import proto from 'proto';

var Base64EncodeTransformer = proto.extend({
	writableStrategy: undefined,
	readableStrategy: undefined,
	// flush(){},
	transform(chunk, write, done){
		write(Base64.encode(chunk));
		done();
	}
});

export default Base64EncodeTransformer;
