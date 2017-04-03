const createParseRessources = require('./create-parse-ressources.js')
const fs = require('fs')
const assert = require('assert')

const test = (name) => {
    const fixture = String(fs.readFileSync('./fixtures/' + name + '/fixture.js'))
    const expected = JSON.parse(String(fs.readFileSync('./fixtures/' + name + '/expected.json')))
    const babel = require('babel-core')
    const actual = []
    babel.transform(fixture, {
        filename: 'fixture.js',
        plugins: [
            createParseRessources(actual)
        ]
    })

    assert.deepEqual(actual, expected, `${name} failed
---- actual -----
${JSON.stringify(actual)}
----- expected -----
${JSON.stringify(expected)}
`)
}

test('export-all-from')
test('export-default-declaration')
test('export-default-specifier')
// test('export-named-declaration-function')
// test('export-named-declaration-variable')
// test('export-named-specifier')
// test('export-named-specifier-as')
// test('export-named-specifier-as-default-from')
// test('export-named-specifier-default-as-from')
// test('export-named-specifier-default-from')
// test('export-named-specifier-from')
// test('import-all')
// test('import-default')
// test('import-default-as')
// test('import-default+import-all')
// test('import-default+import-named')
// test('import-named')
// test('import-named-as')
// test('import-named-as-exported')
// test('import-named-as-exported-and-referenced')
// test('import-nothing')

console.log('all tests passed')
