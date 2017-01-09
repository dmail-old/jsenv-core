import Rest from '../index.js';

import InlineResponseService from '../lib/service-response-inline.js';

var rest = Rest.create();

rest.use(InlineResponseService.create({
	responses: {
		'/200'(){ return 200; },
		'/301'(){ return 301; }
	}
}));

export function suite(add){

	add("/200", function(){
		return this.resolveWith(rest.fetch('/200'), {status: 200});
	});

	add("request can be frozen without throwing any error", function(){
		var request = rest.createRequest({url: '/200'});
		Object.freeze(request);
		return this.resolveWith(rest.fetch(request), {status: 200});
	});

}