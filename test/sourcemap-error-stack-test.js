import jsenv from 'jsenv';

var env = Object.getPrototypeOf(jsenv);

env.generate({logLevel: 'info'}).then(function(myEnv) {
    myEnv.config('a-config', function() {
        console.log('adding an exceptionHandler to', myEnv.id);

        myEnv.exceptionHandler.add(function(error, exception) {
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

    return myEnv.evalMain(mainSource, 'anonymous').then(function(exports) {
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
