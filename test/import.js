/* global System */

require('../index');

global.platform.ready(function(){
	System.import('./test/modules/a.js').then(function(exports){
		console.log(exports.default === 'a');
	});
});