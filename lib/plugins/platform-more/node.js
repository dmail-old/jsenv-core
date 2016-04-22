import os from '@node/os';

// https://nodejs.org/api/process.html#process_process_platform
// 'darwin', 'freebsd', 'linux', 'sunos', 'win32'

export default function(platform) {
    platform.setName(process.platform === 'win32' ? 'windows' : process.platform);
    platform.setVersion(os.release());
}
