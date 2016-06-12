module.exports = function run(filename, options) {
    require('../index.js');

    // console.log('generating env with options', options);

    return global.jsenv.generate(options).then(function(env) {
        var mainModuleURL = env.locate(filename);
        return env.importMain(mainModuleURL);
    });
};
