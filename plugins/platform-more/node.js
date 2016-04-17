import os from '@node/os';

export function install(jsenv) {
    jsenv.config(function populatePlatform() {
        // https://nodejs.org/api/process.html#process_process_platform
        // 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
        jsenv.platform.setName(process.platform === 'win32' ? 'windows' : process.platform);
        jsenv.platform.setVersion(os.release());
    });
}
