var parse = require('../lib/stack-parse.js');
var assert = require('assert');

var stacks = [	
	{
		string: 'Error\n\tat repl:1:1',
		name: 'Error',
		message: '',
		trace: '\n\tat repl:1:1'
	},
	{
		string: 'SyntaxError: Unterminated string constant\n\tat file:///C:/Users/Damien/system-test/test/0-introduction.js:1:0',
		name: 'SyntaxError',
		message: 'Unterminated string constant',
		trace: '\n\tat file:///C:/Users/Damien/system-test/test/0-introduction.js:1:0'
	},
	{
		string: 'Error: message\n\tat ensureEvaluated (file with space.js:2108:26)',
		name: 'Error',
		message: 'message',
		trace: '\n\tat ensureEvaluated (file with space.js:2108:26)'
	},
	{
		string: 'AssertionError: thenable expected : code is not FUSED\n\tat ensureEvaluated (assertion.js!transpiled:74:18)',
		name: 'AssertionError',
		message: 'thenable expected : code is not FUSED',
		trace: '\n\tat ensureEvaluated (assertion.js!transpiled:74:18)'
	},
	{
		string: 'Error: message\n\tat repl:1:1\n\tat repl:1:1',
		name: 'Error',
		message: 'message',
		trace: '\n\tat repl:1:1\n\tat repl:1:1'
	},
	{
		string: 'Error: ENOENT, no such file or directory\n\tat Error (native)\n\tat Object.<anonymous> (file.js:5:9)',
		name: 'Error',
		message: 'ENOENT, no such file or directory',
		trace: '\n\tat Error (native)\n\tat Object.<anonymous> (file.js:5:9)'
	},	
	{
		string: 'SyntaxError: file:///run.js: Unterminated string constant (227:14)\
			\n226 | fail: function(error){\
			\n|     ^\
			\n228 |\
			\n\tat Parser.pp.raise (file.js:65149:13)',
		name: 'SyntaxError',
		message: 'file:///run.js: Unterminated string constant (227:14)\
			\n226 | fail: function(error){\
			\n|     ^\
			\n228 |\
			',
		trace: '\n\tat Parser.pp.raise (file.js:65149:13)'
	}
];

stacks.forEach(function(stack){
	var parts = parse(stack.string);

	assert.equal(parts.name, stack.name);
	assert.equal(parts.message, stack.message);
	assert.equal(parts.trace, stack.trace);
});

