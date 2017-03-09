import responseGenerator from './rest/src/response-generator.js';
import Request from './rest/src/request.js';

var request = Request.create({url: '/200'});

var responsePromise = responseGenerator.create(request);
responsePromise.then(function() {
    console.log('got response', responsePromise);
});
