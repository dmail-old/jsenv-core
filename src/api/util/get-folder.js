var path = require('path');
var rootFolder = path.resolve(__dirname, '../../../').replace(/\\/g, '/');
var featuresFolderPath = rootFolder + '/src/features';

function getFeaturesFolder() {
    return featuresFolderPath;
}

module.exports = getFeaturesFolder;
