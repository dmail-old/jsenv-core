var removeReference = require('./babel-plugin-remove-reference.js')
var fs = require('fs')
var assert = require('assert')

const test = (name, names) => {
    const fixture = String(fs.readFileSync('./fixtures/' + name + '/fixture.js'))
    const expected = String(fs.readFileSync('./fixtures/' + name + '/expected.js'))
    const babel = require('babel-core')
    const result = babel.transform(fixture, {
        plugins: [
            removeReference(names)
        ]
    })
    const actual = result.code

    assert.equal(actual, expected, name + ' did not matched expected output')
}

// test('export-default-declaration-function', ['default'])
// test('export-default-declaration-identifier', ['default'])
// test('export-named-declaration', ['willBeRemoved'])
// test('export-named-specifier', ['willBeRemoved'])
// test('export-named-specifier', ['willBeRemoved'])
// test('weak-variable', ['willBeRemoved'])
// test('strong-variable', ['willBeRemoved'])
test('strong-function', ['willBeRemoved'])
