import childProcess from '@node/child_process';

let execSync = childProcess.execSync;

export default {
    detect() {
        return true;
    },

    config() {
        console.log('No CI Detected. Using git/mercurial');
        var branch = execSync("git rev-parse --abbrev-ref HEAD || hg branch").toString().trim();
        if (branch === 'HEAD') {
            branch = 'master';
        }
        var head = execSync("git rev-parse HEAD || hg id -i --debug | tr -d '+'").toString().trim();
        return {
            commit: head,
            branch: branch
        };
    }
};
