export default {
    detect(env) {
        return Boolean(env.JENKINS_URL);
    },

    config(env) {
        return {
            service: 'jenkins',
            commit: env.ghprbActualCommit || env.GIT_COMMIT,
            branch: env.ghprbSourceBranch || env.GIT_BRANCH,
            build: env.BUILD_NUMBER,
            buildUrl: env.BUILD_URL,
            pullRequest: env.ghprbPullId
        };
    }
};
