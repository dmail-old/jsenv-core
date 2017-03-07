var getFolder = require('./get-folder.js');
function pathFromId(featureId) {
    return getFolder() + '/' + featureId;
}

module.exports = pathFromId;
