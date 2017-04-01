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

    assert.equal(actual, expected, `${name} failed
---- actual -----
${actual}
----- expected -----
${expected}
`)
}

test('export-default-declaration-function', ['default'])
test('export-default-declaration-identifier', ['default'])
test('export-default-declaration-object', ['default'])
test('export-default-declaration-array', ['default'])
test('export-default-declaration-expression', ['default'])
test('export-default-primitive', ['default'])
test('export-named-declaration-variable', ['willBeRemoved'])
test('export-named-declaration-function', ['willBeRemoved'])
test('export-named-specifier', ['willBeRemoved'])
test('export-named-specifier-multiple', ['willBeRemoved'])
test('weak-variable', ['willBeRemoved'])
test('weak-function', ['willBeRemoved'])
test('weak-function-nested', ['willBeRemoved'])
test('strong-variable', ['willBeRemoved'])
test('strong-function', ['willBeRemoved'])
test('strong-function-nested', ['willBeRemoved'])
test('mixed-function', ['willBeRemoved'])
test('strong-and-weak-function', ['willBeRemoved'])
