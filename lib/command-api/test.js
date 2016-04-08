var assert = require('assert');
var cmdAPI = require('./index.js');

(function() {
    var api = cmdAPI({
        name: {
            type: 'string',
            default: true
        },
        age: {
            type: 'number'
        }
    });

    api.populate('-name=foo');
    api.populate('-age=10');

    assert.equal(api.get('name').value, 'foo');
    assert.equal(api.get('age').value, 10);
    assert.equal(api.match(), api.get('name'));
    assert.deepEqual(api.toValues(), {name: 'foo', age: 10});
})();

(function() {
    var api = cmdAPI({
        0: {
            type: 'string',
            default: true
        }
    });

    api.populate('hello', 0);

    assert.equal(api.get(0).value, 'hello');
})();

(function() {
    var api = cmdAPI({
        command: {

        }
    });

    api.populate('-command=b');
    assert.equal(api.get('command').value, 'b');
    api.populate('--command=c');
    assert.equal(api.get('command').value, 'c');
})();

(function() {
    var api = cmdAPI({
        command: {
            main: true,
            params: {
                paramA: {
                    params: {
                        foo: {

                        }
                    }
                },
                paramB: {

                }
            }
        }
    });

    api.populate('-command');
    api.populate('-command-paramA');
    api.populate('-command-paramA-foo=bar');

    assert.equal(api.get('command-paramA-foo').value, 'bar');
})();
