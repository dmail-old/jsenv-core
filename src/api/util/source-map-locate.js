var path = require('path');

function locateSourceMap(mapping, filename) {
    mapping.file = path.basename(filename);
    mapping.sources = mapping.sources.map(function(source) {
        return path.relative(filename, source).replace(/\\/g, '/');
    });
    return mapping;
}

module.exports = locateSourceMap;
