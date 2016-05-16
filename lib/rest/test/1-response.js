import Response from '../lib/response.js';

export function suite(add){

	add('headers options', function(){
		var response = Response.create({
			headers: {
				'content-length': 10
			}
		});

		this.equal(response.headers.get('content-length'), 10);
	});

	add('headers clone', function(){
		var response = Response.create({
			headers: {
				'content-length': 10
			}
		});

		var clonedResponse = response.clone();

		this.equal(clonedResponse.headers.has('content-length'), true);
		this.equal(clonedResponse.headers.get('content-length'), 10);
	});

}