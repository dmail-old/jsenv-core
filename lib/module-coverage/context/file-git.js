import childProcess from '@node/child_process';

function cmd(source) {
    return new Promise(function(resolve, reject) {
        childProcess.exec(source, function(error, stdout, stderr) {
            if (error) {
                reject(error);
            } else if (stderr) {
                reject(stderr);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

export default {
    name: 'git',

    detect() {
        return cmd('git rev-parse --is-inside-work-tree').then(function(output) {
            return output === 'true';
        });
    },

    config() {
        return Promise.all([
            cmd("git rev-parse HEAD || hg id -i --debug | tr -d '+'"),
            cmd('git rev-parse --abbrev-ref HEAD || hg branch')
        ]).then(function(values) {
            var commit = values[0];
            var branch = values[1];

            if (branch === 'HEAD') {
                branch = 'master';
            }

            return {
                commit: commit,
                branch: branch
            };
        });
    }
};
