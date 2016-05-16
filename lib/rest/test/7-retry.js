import Rest from '../index.js';
import InlineResponseService from '../lib/service-response-inline.js';

var rest = Rest.create();

rest.use(InlineResponseService.create({
	retried: false,
	responses: {
		'/retry:100'(){
			if( this.retried ){
				this.retried = false;
				return 200;
			}
			else{
				this.retried = true;
				return {
					status: 503,
					headers: {
						'retry-after': 0.1
					}
				};
			}
		}
	}
}));

export function suite(add){

	add("on retry, request is resent after a delay", function(){
		return this.resolveIn(rest.fetch('/retry:100'), 100);
	});
	
}