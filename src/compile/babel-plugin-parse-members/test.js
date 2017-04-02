var createParseMembers = require('./create-parse-members.js')
var fs = require('fs')
var assert = require('assert')

const test = (name) => {
    const fixture = String(fs.readFileSync('./fixtures/' + name + '/fixture.js'))
    const expected = JSON.parse(String(fs.readFileSync('./fixtures/' + name + '/expected.json')))
    const babel = require('babel-core')
    const actual = []
    babel.transform(fixture, {
        filename: 'fixture.js',
        plugins: [
            createParseMembers(actual)
        ]
    })

    assert.deepEqual(actual, expected, `${name} failed
---- actual -----
${JSON.stringify(actual)}
----- expected -----
${JSON.stringify(expected)}
`)
}

test('export-all')
test('export-default-declaration')
test('export-default-specifier')
