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
            console.log('error.fileName & error.lineNumber ok with transpiled anonymous module');
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
