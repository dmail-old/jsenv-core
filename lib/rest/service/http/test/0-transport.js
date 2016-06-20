import Rest from '../node_modules/@dmail/rest/index.js';
import Server from '../node_modules/@dmail/server-node/index.js';

import httpService from '../index.js';

var url = 'http://127.0.0.1:8000';
var server = Server.create(function(request, response){
	response.writeHead(200, {'content-type': 'application/javascript'});
	response.end('export default true');
});

export function beforeAll(){
	return server.open(url);
}

export function afterAll(){
	return server.close();
}

export function suite(add){
	add("node transportRequest", function(){
		var rest = Rest.create();

		rest.use(httpService);

		return this.resolveWith(rest.fetch(url).then(function(response){
			return response.text();
		}), 'export default true');
	});
}