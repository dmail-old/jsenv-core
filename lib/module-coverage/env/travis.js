export default {
    detect(env) {
        return Boolean(env.TRAVIS);
    },

    config(env) {
        console.log('Travis CI Detected');
        return {
            service: 'travis',
            commit: env.TRAVIS_COMMIT,
            build: env.TRAVIS_JOB_NUMBER,
            branch: env.TRAVIS_BRANCH,
            job: env.TRAVIS_JOB_ID,
            pr: env.TRAVIS_PULL_REQUEST,
            slug: env.TRAVIS_REPO_SLUG,
            root: env.TRAVIS_BUILD_DIR
        };
    }
};
