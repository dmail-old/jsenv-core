import env from 'env';

var System = env.System;

System.normalize('./test.js', 'dmail@github/argv/index.js').then(function() {
	console.log('here', arguments);
});
