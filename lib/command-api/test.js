var assert = require('assert');
var cmdAPI = require('./index.js');

var api = cmdAPI({
    name: {
        type: 'string',
        default: true
    },
    age: {
        type: 'number'
    }
});

api.parse('-name=foo');
api.parse('-age=10');

assert.equal(api.params.get('name').value, 'foo');
assert.equal(api.params.get('age').value, 10);
