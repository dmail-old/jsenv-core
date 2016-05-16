import Rest from '../index.js';

export function suite(add){
	
	add("timeout", function(){
		var responseGenerator = Rest.fetch('/');

		responseGenerator.timeout.set(40);

		return this.rejectWith(responseGenerator, {name: 'NetWorkError', code: 'REQUEST_TIMEOUT'});
	});

	add("client lost interest in response callling abort()", function(){
		var responseGenerator = Rest.fetch('/');

		setTimeout(function(){
			responseGenerator.abort();
		}, 20);
		responseGenerator.timeout.set(50);

		return this.rejectWith(responseGenerator, {name: 'NetWorkError', code: 'REQUEST_TIMEOUT'});
	});
	
}