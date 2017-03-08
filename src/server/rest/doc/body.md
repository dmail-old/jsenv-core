# Body

Object representing the body of an http request or an http response

## Body.create(data)

```javascript
import Body from './lib/body.js';

var body = Body.create();

body.pipeTo(writableStream); // writableStream can be a [node one](https://nodejs.org/api/stream.html#stream_class_stream_writable) or a [browser one](https://streams.spec.whatwg.org/#ws-class)
body.close(); // close this stream and all piped streams & remove pipes
body.tee(); // returns an array of two streams that you can consume or not
body.then(onResolve, onError); // onResolve is called when the body is closed, onError if an error occurs
body.readAsString(); // return a promise fullfilled with body as string or rejected if an error occurs
body.cancel(); // clear all data
```

Depending on data passed the stream has different state :
- undefined : nothing is done
- null : the stream is immediatly closed
- String : the string is written in the stream & the stream is closed
- node ReadableStream : the readable stream is piped into this stream
