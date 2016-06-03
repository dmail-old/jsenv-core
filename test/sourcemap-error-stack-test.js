import jsenv from 'jsenv';

var source = `
export default function() {
    throw new Error("here");
}
`;
var sourceAddress = 'anonymous';

Promise.resolve().then(function() {
    return jsenv.generate({logLevel: 'info'}).then(function(env) {
        // jsenv.exceptionHandler.add(function(error) {
        //     console.log('handling exception', error);
        //     return true;
        // });

        console.log(jsenv.FileSource.redirections);
        console.log(Object.keys(jsenv.FileSource.cache));

        return env.evalMain(source, sourceAddress).then(function(exports) {
            // exports.default();
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
