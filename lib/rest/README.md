# rest

Request filesystem, http server and other ressources under a single API, rest oriented.

## Description

This module generates response for given request. Using built-in or custom service you'll get appropriate responses. 

#### Example

Introducing the API

```javascript
import Rest from 'dmail/rest';

// create a rest object
var rest = Rest.create();

// create a request
var request = rest.createRequest({
	url: 'foo'
});

// create a hello world service, returning 200 Hello world for any get request
var helloWorldService = rest.createService({
	match(request){ return true; },
	methods: {
		get(){
			return {
				status: 200
				body: 'Hello world'
			};
		}
	}
});

// by default fetching the request will produce 501 response (not implemented)
rest.fetch(request).then(function(response){ return response.status; }); // 501
// we can use the helloWorldService to get a reponse
rest.use(helloWorldService);
rest.fetch(request).then(function(response){ return response.text(); }); // 'Hello world'
```

#### Features

- Support request redirection
- Support request retry
- Support request timeout
- Support request abortion
- Can keep request body opened to let consumer push data to the producer
- Can keep response body opened to let producer push data to the consumer

#### Service

Services are object used to create custom response or modify them

```javascript
import Rest from 'dmail/rest';

var CustomService = Rest.createService({
	name: 'custom',
	status: 0,

	constructor(options){
		CustomService.super.constructor.call(this, options);
	},

	// return a boolean indicating if the service handles the request, support thenable
	match(request){
		return Promise.resolve(true);
	},

	// hook called depending on request.method, when service match the request
	methods: {
		// produce a 200 response
		get(){
			return Promise.resolve(this.status);
		}
	},
	
	// hook called once response is created to allow response transformation
	intercept(request, response){
		// change the response status to 201
		response.status++;
		return Promise.resolve();
	}
});

var rest = Rest.create();
rest.use(CustomService.create({status: 200}));
rest.fetch('foo').then(function(response){ return response.status; }); // 201
```

Core services :

Name | Request match overview | Created response description | Repository
---- | ---------------- | ----------- | ------------
http | http(s)://* | Created from http server | [dmail/service-http](https://github.com/dmail/service-http)
file | file:///* | Created from filesystem operations | [dmail/service-file](https://github.com/dmail/service-file)
file-github | file-github://* | Created from http API calls to github.com | [dmail/service-file-github](https://github.com/dmail/service-file-github)
cache | * | Created from an in memory cache | [dmail/service-cache](https://github.com/dmail/service-cache)
Page | file:///*.page.js | Execute .page.js files to transform the response | Todo 
