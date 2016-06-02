import jsenv from 'jsenv';

jsenv.generate({logLevel: 'info'}).then(function(env) {
    env.config('a-config', function() {
        console.log('adding an exceptionHandler to', env.id);

        env.exceptionHandler.add(function(error, exception) {
            console.log('handling exception on', this.env.id);
            return true;
        });
        // console.log(myEnv.exceptionHandler, jsenv.exceptionHandler);
    });

    var mainSource = `
        export default function() {
            throw new Error("here");
        }
    `;

    return env.evalMain(mainSource, 'anonymous').then(function(exports) {
        exports.default();
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
