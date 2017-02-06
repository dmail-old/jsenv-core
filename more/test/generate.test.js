import jsenv from 'jsenv';

import assert from '@node/assert';

Promise.resolve().then(function() {
    return jsenv.generate();
}).then(function(envA) {
    assert.equal(envA.id, '<env #3>');
    console.log('env3 generated');
    return jsenv.generate();
}).then(function(envB) {
    assert.equal(envB.id, '<env #4>');
    console.log('env4 generated');
});
