require('../../jsenv.js');
var getFolder = require('./get-folder.js');

function idFromNode(node) {
    var relative = node.id.slice(getFolder().length + 1);
    return jsenv.parentPath(relative);
}

module.exports = idFromNode;
