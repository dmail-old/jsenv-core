var parse = require('../lib/callsite-parse.js');

function match(actual, expected){
	var maxDifferencesLogged = 5;

	if( actual != expected ){
		var differences = Object.keys(expected).filter(function(key){
			return actual[key] != expected[key];
		});
		var length = differences.length;

		if( length ){
			var message = 'actual has '+ length +' differences with expected : \n';
			var diff = length - maxDifferencesLogged;

			if( length > 5 ){
				differences = differences.slice(5);
			}

			message+= differences.map(function(key){
				return key + ': ' + actual[key] + ' != ' + expected[key];
			}).slice(maxDifferencesLogged).join('\n');

			if( length > maxDifferencesLogged ){
				message+= '...';
			}

			var error = new Error();
			error.name = 'AssertionError';
			error.message = message;
			throw error;
		}
	}
}

var lines = [
	{
		source: 'at repl:1:1',
		parsed: {
			fileName: 'repl',
			lineNumber: 1,
			columnNumber: 1
		}
	},
	{
		source: 'at Error (native)',
		parsed: {
			functionName: 'Error',
			fromNative: true,
		}
	},
	{
		source: 'at ensureEvaluated (file with space.js:2108:26)',
		parsed: {
			functionName: 'ensureEvaluated',
			fileName: 'file with space.js',
			lineNumber: 2108,
			columnNumber: 26
		}
	},
	{
		source: 'at REPLServer.defaultEval (repl.js:132:27)',
		parsed: {
			methodName: 'defaultEval',
			fileName: 'repl.js',
			lineNumber: 132,
			columnNumber: 27
		}
	},
	{
		source: 'at REPLServer.runBound [as eval] (C:\\domain.js:267:12)',
		parsed: {
			methodName: 'runBound',
			functionName: 'eval',
			fileName: 'file:///C:/domain.js',
			lineNumber: 267,
			columnNumber: 12
		}
	},
	{
		source: 'at eval (eval at <anonymous> (file.js:4:2), <anonymous>:1:1)',
		site: 'at eval',
		location: 'eval at <anonymous> (file.js:4:2), <anonymous>:1:1',
		parsed: {
			functionName: 'eval',
			fileName: 'file.js',
			lineNumber: 4,
			evalFileName: null,
			evalLineNumber: 1,
			evalColumnNumber: 1
		}
	},
	{
		source: 'at new constructor (file.js:152:11)',
		site: 'at new constructor',
		location: 'file.js:152:11',
		parsed: {
			fromConstructor: true,
			functionName: 'constructor'
		}
	},
	{
		source: 'at Test.(anonymous function) [as equal] (file.js:157:15)',
		site: 'at Test.(anonymous function) [as equal]',
		location: 'file.js:157:15',
		parsed: {
			methodName: null,
			functionName: 'equal'
		}
	},
	{
		source: 'at null.<anonymous> (<anonymous>)',
		site: 'at null.<anonymous>',
		location: '<anonymous>',
		parsed: {
			methodName: null,
			typeName: 'null'
		}
	}
];

lines.forEach(function(line){
	match(parse(line.source), line.parsed);
});