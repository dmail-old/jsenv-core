import jsenv from 'jsenv';

var env = Object.getPrototypeOf(jsenv);

env.generate({logLevel: 'info'}).then(function(myEnv) {
    myEnv.config('a-config', function() {
        myEnv.exceptionHandler.add(function(error) {
            console.log('an error occured', error, error.stack);
            return true;
        });
    });

    return myEnv.evalMain('export default function() { throw new Error("here"); }', 'anonymous').then(function(exports) {
        exports.default();
    });
});
