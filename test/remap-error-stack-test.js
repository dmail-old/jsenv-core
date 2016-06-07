// seems to work BUT callsite.ready() seems to be called twice

import jsenv from 'jsenv';

import assert from '@node/assert';

var source = `
export default function() {
    throw new Error("here");
}
`;
var sourceAddress = 'anonymous';
// var selfUrl = env.mainAction.module.href;

Promise.resolve().then(function() {
    // anonymous module
    return jsenv.generate({logLevel: 'info'}).then(function(env) {
        return env.evalMain(source, sourceAddress).then(function(exports) {
            exports.default();
        }).catch(function(error) {
            assert.equal(error.message, 'here');
            return error.prepare().then(function() {
                return error;
            });
        }).then(function(error) {
            assert.equal(error.fileName, env.locate('anonymous'));
            assert.equal(error.lineNumber, 3);
            assert.equal(error.lineSource, source.split('\n')[2]);
            console.log('error.fileName, lineNumber & lineSource ok with transpiled anonymous module');
        });
    });
}).then(function() {
    // imported module
    return jsenv.generate({logLevel: 'info'}).then(function(env) {
        return env.importMain('./modules/module-error.js').then(function(exports) {
            return exports.default();
        }).catch(function(error) {
            return error.prepare().then(function() {
                return error;
            });
        }).then(function(error) {
            assert.equal(error.fileName, jsenv.locate('./modules/module-error.js'));
            assert.equal(error.lineNumber, 4);
            assert(error.lineSource.indexOf('This is the original code') > -1);
            console.log('error.fileName, lineNumber & lineSource ok with imported module');
        });
    });
});

// jsenv.exceptionHandler.add(function(error) {
//     console.log('an error occured', error, error.stack);
// });

// var mainSource = `
//     export default function() {
//         throw new Error("here");
//     }
// `;

// jsenv.System.module(mainSource, 'anonymous').then(function(exports) {
//     exports.default();
// });
