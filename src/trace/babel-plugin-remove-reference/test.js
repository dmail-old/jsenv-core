var removeReference = require('./babel-plugin-remove-reference.js');
var fs = require('fs');
var assert = require('assert');

function test(name, names) {
    var fixture = String(fs.readFileSync('./fixtures/' + name + '/fixture.js'));
    var expected = String(fs.readFileSync('./fixtures/' + name + '/expected.js'));
    var babel = require('babel-core');
    var result = babel.transform(fixture, {
        plugins: [
            removeReference(names)
        ]
    });
    var actual = result.code;

    assert.equal(actual, expected);
}

// test('export-default-declaration-function', ['default']);
// test('export-default-declaration-identifier', ['default']);
// test('export-named-declaration', ['willBeRemoved']);
// test('export-named-specifier', ['willBeRemoved']);
// test('export-named-specifier', ['willBeRemoved']);
test('weak-variable', ['willBeRemoved']);
// test('strong-variable', ['willBeRemoved']);
// test('strong-function', ['willBeRemoved']);
