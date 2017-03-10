import Rest from '../index.js';

import InlineResponseService from '../lib/service-response-inline.js';

var rest = Rest.create();

rest.use(InlineResponseService.create({
	responses: {
		'/200'(){
			return 200;
		},

		'/redirected'(){
			return {
				status: 301,
				headers: {
					'location': '/200'
				}
			};
		}
	}
}));

export function suite(add){

	add("on redirection, redirect when request.redirectMode == 'follow'", function(){
		return this.resolveWith(rest.fetch('/redirected'), {status: 200});
	});

	add("on redirection, response.redirectCount is incremented", function(){
		return this.resolveWith(rest.fetch('/redirected'), {redirectCount: 1});
	});

	add("on redirection, reject when request.redirectCount > responseGenerator.redirectLimit", function(){
		var responseGenerator = rest.fetch('/redirected');
		responseGenerator.redirectLimit = 0;

		return this.rejectWith(responseGenerator, {name: 'NetWorkError'});
	});

	add("on redirection, reject when request.redirectMode == 'error'", function(){
		return this.rejectWith(rest.fetch('/redirected', {redirectMode: 'error'}), {name: 'NetWorkError'});
	});
	
}