import Rest from '../index.js';

export function suite(add){

	add("get baseURL", function(){
		this.equal(Rest.baseURL.protocol, 'file:');
		this.equal(Rest.baseURL.pathname.endsWith('rest/test/'), true);
	});

	add("set baseURL", function(){
		var rest = Rest.create();

		rest.baseURL = new URL('https://google.com');

		this.equal(rest.baseURL.protocol, 'https:');

		var url = rest.locate('/index.html');

		this.equal(url.href, 'https://google.com/index.html');
	});
	
	add("locate", function(){
		var url = Rest.locate('./index.js');

		this.match(url, {
			protocol: 'file:',
		});
	});

	add("get() without arguments is valid", function(){
		return this.resolveWith(Rest.get(), {status: 501});
	});

	add("use + findServiceByName", function(){
		var rest = Rest.create();

		var customService = rest.createService({
			name: 'custom'
		});

		rest.use(customService);

		this.equal(rest.findServiceByName('custom'), customService);
	});

	add("findServiceMatch returns the matched service for a given request", function(){
		var rest = Rest.create();

		var serviceA = rest.createService({
			name: 'service-a',
			match(){
				return Promise.resolve(false);
			}
		});
		var serviceB = rest.createService({
			name: 'service-b',
			match(){
				return true;
			}
		});

		rest.use(serviceA);
		rest.use(serviceB);

		var request = rest.createRequest();

		return this.resolveWith(rest.findServiceMatch(request), serviceB);
		/*
		return rest.findServiceMatch(request).then(function(service){
			this.equal(service, serviceB);
		}.bind(this));
		*/
	});

}