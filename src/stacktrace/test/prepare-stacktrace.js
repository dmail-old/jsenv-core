var StackTrace = require('../index.js');
var assert = require('assert');

function isError(){
	//return Object.prototype.toString.call(e) === '[object Error]';
}

function assertStackGetterSetStackTrace(error, message){
	var stack = error.stack;
	//StackTrace.install(error); // do the same

	if( false === error instanceof Error ){
		throw new Error('expecting error ' + message);
	}

	if( false === 'stackTrace' in error ){
		throw new Error(message);
	}
}

assertStackGetterSetStackTrace(new Error(), 'before platform');
//assert.equal(error.fileName, __filename);
//assert.equal(error.lineNumber, 4);

require('../../system-platform');
assertStackGetterSetStackTrace(new Error(), 'after platform');

Promise.resolve().then(function(){
	throw new Error();
}).catch(function(e){
	assertStackGetterSetStackTrace(e, 'on promise catch');
});

var baseLocation =  'file:///' + __filename.replace(/\\/g, '/');
var location = platform.locateFrom('./modules/error.js', baseLocation);
//console.log(baseLocation, location);
System.import(location).catch(function(e){
	console.log('the error', e);
	//assertStackGetterSetStackTrace(e, 'on system import catch');
}).then(function(exports){
	exports.default();
}).catch(function(e){
	throw e;
}).catch(function(e){
	assertStackGetterSetStackTrace(e, 'on system import catch');
});

/*
error.unshift({
	fileName: 'myfilename',
	lineNumber: 10,
	columnNumber: 5
});
*/