# headers

Object representing http headers of a request/response

```javascript
import Headers from './lib/headers.js';

var headers = Header.create({
	'accept': 'html'
});

headers.has('accept'); // true
headers.set('user-agent', 'node');
headers.get('user-agent'); // 'node'
headers.delete('user-agent');
headers.toString(); // 'accept: html'

Array.from(headers.values()); // [['html']]
Array.from(headers.keys()); // ['accept']
Array.from(headers.entries()); // [['accept'], [['html']]]
```