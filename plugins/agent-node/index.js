/* global __moduleName */

import os from 'node/os';
import engine from 'engine';

engine.config(function provideRestart() {
    engine.restart = function() {
        process.kill(2);
    };
});

engine.config(function populatePlatform() {
    // https://nodejs.org/api/process.html#process_process_platform
    // 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
    engine.platform.setName(process.platform === 'win32' ? 'windows' : process.platform);
    engine.platform.setVersion(os.release());
});

engine.config(function populateAgent() {
    engine.agent.setName('node');
    engine.agent.setVersion(process.version.slice(1));
});

engine.config(function populateLanguage() {
    engine.language.listPreferences = function() {
        if ('lang' in process.env) {
            return process.env.lang;
        }
        return '';
    };
});

engine.config(function configLogLevel() {
    if (process.argv.indexOf('-verbose') !== -1) {
        engine.logLevel = 'error';
    }
});

engine.config(function improveSyntaxError() {
    var improveSyntaxError = function(error) {
        if (error && error.name === 'SyntaxError' && error._babel) {
            // error.loc contains {line: 0, column: 0}
            var match = error.message.match(/([\s\S]+): Unterminated string constant \(([0-9]+)\:([0-9]+)/);
            if (match) {
                var improvedError = new SyntaxError();
                var column = match[3];
                column += 63; // because node-sourcemap/index.js:155 will do column-=63
                var stack = '';
                stack += 'SyntaxError: Unterminated string constant\n\t at ';
                stack += match[1] + ':' + match[2] + ':' + column;
                improvedError.stack = stack;
                return improvedError;
            }
        }
        return error;
    };

    var translate = System.translate;
    System.translate = function(load) {
        return translate.call(this, load).catch(function(error) {
            error = improveSyntaxError(error);
            return Promise.reject(error);
        });
    };
}).skip('not ready yet');

engine.plugin('exception-stacktrace', {
    locate: function() {
        return engine.locate('./' + this.name + '/index.js', __moduleName);
    }
});

engine.plugin('module-coverage', {
    locate: function() {
        return engine.locate('./' + this.name + '/index.js', __moduleName);
    }
});
