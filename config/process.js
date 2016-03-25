import os from 'node/os';
import engine from 'engine';

engine.restart = function() {
    process.kill(2);
};

// https://nodejs.org/api/process.html#process_process_platform
// 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
engine.platform.setName(process.platform === 'win32' ? 'windows' : process.platform);
engine.platform.setVersion(os.release());

engine.agent.setName('node');
engine.agent.setVersion(process.version.slice(1));

engine.language.listPreferences = function() {
    if ('lang' in process.env) {
        return process.env.lang;
    }
    return '';
};
