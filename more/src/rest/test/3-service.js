import Rest from '../index.js';

export function suite(add){

	add("match called with request", function(){
		var rest = Rest.create();

		var request = rest.createRequest();
		var customService = rest.createService({
			name: 'custom',
			match: this.spy()
		});

		rest.use(customService);

		return rest.fetch(request).then(function(){
			return this.calledWith(customService.match, request);
		}.bind(this));
	});

	add("methods called with request when service has matched", function(){
		var rest = Rest.create();

		var request = rest.createRequest();
		var customService = rest.createService({
			name: 'custom',
			match(){ return true; },
			methods: {
				'get': this.spy()
			}
		});

		rest.use(customService);

		return rest.get(request).then(function(){
			return this.calledWith(customService.methods.get, request);
		}.bind(this));
	});

	add('method hook return number will be response.status', function(){
		var rest = Rest.create();

		var request = rest.createRequest();
		var customService = rest.createService({
			name: 'custom',
			match(){ return true; },
			methods: {
				get(){
					return 200;
				}
			}
		});

		rest.use(customService);

		return this.resolveWith(rest.get(request), {status: 200});
	});

	add('method hook return body will be response body', function(){
		var rest = Rest.create();

		var request = rest.createRequest();
		var customService = rest.createService({
			name: 'custom',
			match(){ return true; },
			methods: {
				get(){
					return {
						body: 'Hello world'
					};
				}
			}
		});

		rest.use(customService);

		return this.resolveWith(rest.fetch(request).then(function(response){
			return response.text();
		}), 'Hello world');
	});

	add("intercept is called with request & response", function(){
		var rest = Rest.create();

		var request = rest.createRequest();

		var customService = rest.createService({
			name: 'custom',
			match(){ return false; },
			intercept: this.spy()
		});

		rest.use(customService);

		return rest.fetch(request).then(function(response){
			return this.calledWith(customService.intercept, request, response);
		}.bind(this));
	});

}