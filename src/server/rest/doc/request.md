# Request

Object representing an http request

## create(options = {})

Create an http request object you can pass several options

```javascript
var GET = {
	method: 'GET',
	url: 'http://google.fr',
	headers: {
		 'x-foo': 'bar'
	}
};
var POST = {
	method: 'POST',
	url: 'http://google.fr',
	headers: {
		 'x-foo': 'bar'
	},
	body: 'Hello world'
};

// create two request object, requests are not sent !
var requestA = Request.create(GET);
var requestB = Request.create(POST);
```

## options.redirectMode

name | description
---- | -----------
follow | follow response redirections (default)
error | throw NetWorkError when response has a redirect status
manual | do nothing when response has a redirect status

## options.cacheMode

name | description
---- | -----------
default | response for this request will be stored (default)
no-store | response for this request will not be stored
no-cache | same as no-store
reload | store the response in cache ignoring any current cached response
force-cache | same as default
only-if-cached | get only a cached response

## Intercept requests

You can intercept request to provide your own response.

```javascript
Request.intercept(function(request){
	if( request.url.match('foo') ){
		return {
			status: 200,
			body: 'Hello world'
		}
	}
});

Request.create({
	url: 'foo'
}).then(function(response){
	return response.text();
}).then(console.log);
// logs 'Hello world'
```

## createResponsePropertiesPromise()

This method must be implemented to return a promise resolving to response properties.  

## createResponsePropertiesPromise() example

This example creates a request always locally producing 200 'Hello world' responses.

```javascript
var helloWorldRequest = Request.extend({
	createResponsePropertiesPromise: function(){
		return Promise.resolve({
			status: 200,
			headers: {},
			body: 'Hello world'
		});
	}
});
```

## createResponsePropertiesPromise() cancellable example

This exampels creates a request producing 'Hello world' response after 100ms. The request can be aborted manually or by timeout to prevent response from being created.

```javascript
var CancellableRequest = Request.extend({
	createResponsePropertiesPromise: function(){
		var timer;
		var promise = new Promise(function(resolve, reject){
			timer = setTimeout(function(){
				resolve({
					status: 200,
					headers: {},
					body: 'Hello world'
				})
			}, 100);
		});

		promise.cancel = function(){
			clearTimeout(timer);
		};

		return promise;
	}
});

var request = CancellableRequest.create();
request.connect(); // request takes 100ms to create a response
request.abort(); // will call promise.cancel() to avoid the creation of a useless response
```
