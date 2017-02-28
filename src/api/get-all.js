var build = require('./build.js');
var featureTranspiler = require('./transpiler.js')();

function getAll(featureNames) {
    return build(featureNames, {
        transpiler: featureTranspiler,
        mode: 'test'
    }).then(function(build) {
        return build.compile();
    });
}
// getAllFeature([
//     'object/assign'
// ]).then(function(features) {
//     console.log('got features', features);
// }).catch(function(e) {
//     setTimeout(function() {
//         throw e;
//     });
// });

module.exports = getAll;
