export default {
    detect(env) {
        return Boolean(env.JENKINS_URL);
    },

    config(env) {
        console.log('Jenkins CI Detected');
        return {
            service: 'jenkins',
            commit: env.ghprbActualCommit || env.GIT_COMMIT,
            branch: env.ghprbSourceBranch || env.GIT_BRANCH,
            build: env.BUILD_NUMBER,
            build_url: env.BUILD_URL, // eslint-disable-line
            root: env.WORKSPACE,
            pr: env.ghprbPullId
        };
    }
};
