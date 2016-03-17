import os from 'node/os';

var engine = global.engine;

// https://nodejs.org/api/process.html#process_process_platform
// 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
engine.platform.setName(process.platform === 'win32' ? 'windows' : process.platform);
engine.platform.setVersion(os.release());

engine.agent.setName('node');
engine.agent.setVersion(process.version.slice(1));

engine.language.set(process.env.lang);

engine.restart = function() {
    process.kill(2);
};
