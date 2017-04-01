const parse = require('./parse.js')
const assert = require('assert') // eslint-disable-line
const fs = require('fs')

const test = (name) => {
    return parse(
        './fixtures/' + name + '/main.js',
        {
            variables: {
                platform: 'node'
            }
        }
    ).then((trace) => { // eslint-disable-line
        const testSource = String(fs.readFileSync('./fixtures/' + name + '/test.js'))
        global.trace = trace
        global.assert = assert
        require('vm').runInThisContext(testSource)
    })
}

[
    'variable'
].reduce((previous, name) => {
    return previous.then(() => {
        return test(name)
    })
}, Promise.resolve()).catch((e) => {
    setTimeout(() => {
        throw e
    })
})
