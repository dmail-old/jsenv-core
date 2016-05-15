export default {
    detect(env) {
        return Boolean(env.TRAVIS);
    },

    config(env) {
        return {
            service: 'travis',
            commit: env.TRAVIS_COMMIT,
            build: env.TRAVIS_JOB_NUMBER,
            branch: env.TRAVIS_BRANCH,
            job: env.TRAVIS_JOB_ID,
            pullRequest: env.TRAVIS_PULL_REQUEST,
            slug: env.TRAVIS_REPO_SLUG
        };
    }
};
