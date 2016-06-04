// import proto from 'jsenv/proto';
import jsenv from 'jsenv';

var FileSource = jsenv.FileSource;

var Collector;
var metaInfo = new WeakMap();

function getSourceCoverage(filename) {
    var data = {
        path: filename,
        statementMap: {},
        fnMap: {},
        branchMap: {},
        s: {},
        b: {},
        f: {}
    };
    metaInfo.set(data, {
        indexes: {},
        lastIndex: {
            s: 0,
            b: 0,
            f: 0
        }
    });

    return {
        data: data,
        meta: metaInfo.get(data)
    };
}

function getMapping(fileSource, location) {
    /* jshint maxcomplexity: 11 */
    var start = fileSource.getOriginalPosition(location.start);
    var end = fileSource.getOriginalPosition(location.end);

    /* istanbul ignore if: edge case too hard to test for */
    if (!start || !end) {
        return null;
    }
    if (!start.source || !end.source || start.source !== end.source) {
        return null;
    }
    /* istanbul ignore if: edge case too hard to test for */
    if (start.line === null || start.column === null) {
        return null;
    }
    /* istanbul ignore if: edge case too hard to test for */
    if (end.line === null || end.column === null) {
        return null;
    }
    // var src = start.source;

    if (start.line === end.line && start.column === end.column) {
        end = fileSource.getOriginalPosition({
            line: location.end.line,
            column: location.end.column,
            bias: 2
        });
        end.column--;
    }

    return {
        source: start.source,
        loc: {
            start: {
                line: start.line,
                column: start.column
            },
            end: {
                line: end.line,
                column: end.column
            },
            skip: location.skip
        }
    };
}

function each(object, fn) {
    Object.keys(object).forEach(function(key) {
        fn(object[key], key, object);
    });
    return object;
}

function remapFileCoverage(fileCoverage, fileSource) {
    each(fileCoverage.fnMap, function(genItem, key) {
        var mapping = getMapping(fileSource, genItem.loc);

        if (!mapping) {
            return;
        }

        var hits = fileCoverage.f[key];
        var covInfo = getSourceCoverage(mapping.source);
        var data = covInfo.data;
        var meta = covInfo.meta;
        var srcItem = {
            name: genItem.name,
            line: mapping.loc.start.line,
            loc: mapping.loc
        };
        if (genItem.skip) {
            srcItem.skip = genItem.skip;
        }
        var originalKey = [
            'f',
            srcItem.loc.start.line, srcItem.loc.start.column,
            srcItem.loc.end.line, srcItem.loc.end.column
        ].join(':');

        var fnIndex = meta.indexes[originalKey];
        if (!fnIndex) {
            fnIndex = ++meta.lastIndex.f;
            meta.indexes[originalKey] = fnIndex;
            data.fnMap[fnIndex] = srcItem;
        }
        data.f[fnIndex] = data.f[fnIndex] || 0;
        data.f[fnIndex] += hits;
    });

    each(fileCoverage.statementMap).forEach(function(genItem, key) {
        var mapping = getMapping(fileSource, genItem);

        if (!mapping) {
            return;
        }

        var hits = fileCoverage.s[key];
        var covInfo = getSourceCoverage(mapping.source);
        var data = covInfo.data;
        var meta = covInfo.meta;

        var originalKey = [
            's',
            mapping.loc.start.line, mapping.loc.start.column,
            mapping.loc.end.line, mapping.loc.end.column
        ].join(':');

        var stIndex = meta.indexes[originalKey];
        if (!stIndex) {
            stIndex = ++meta.lastIndex.s;
            meta.indexes[originalKey] = stIndex;
            data.statementMap[stIndex] = mapping.loc;
        }
        data.s[stIndex] = data.s[stIndex] || 0;
        data.s[stIndex] += hits;
    });

    each(fileCoverage.branchMap).forEach(function(genItem, key) {
        var locations = [];
        var source;
        var originalKey = ['b'];

        var mappings = genItem.locations.map(function(location) {
            return getMapping(fileSource, location);
        }).filter(function(mapping) {
            return mapping;
        });

        var firstSource = mappings[0];
        var sourceMappings = mappings.filter(function(mapping) {
            return mapping.source === firstSource;
        });

        sourceMappings.forEach(function(sourceMapping) {
            locations.push(sourceMapping.loc);
            originalKey.push(
                sourceMapping.loc.start.line,
                sourceMapping.loc.start.column,
                sourceMapping.loc.end.line,
                sourceMapping.loc.end.line
            );
        });

        originalKey = originalKey.join(':');

        var hits = fileCoverage.b[key];
        var covInfo = getSourceCoverage(source);
        var data = covInfo.data;
        var meta = covInfo.meta;

        var brIndex = meta.indexes[originalKey];
        if (!brIndex) {
            brIndex = ++meta.lastIndex.b;
            meta.indexes[originalKey] = brIndex;
            data.branchMap[brIndex] = {
                line: locations[0].start.line,
                type: genItem.type,
                locations: locations
            };
        }

        if (!data.b[brIndex]) {
            data.b[brIndex] = locations.map(function() {
                return 0;
            });
        }

        hits.forEach(function(hit, index) {
            data.b[brIndex][index] += hits[index];
        });
    });

    return fileCoverage;
}

function remap(coverage, options) {
    options = options || {};

    var warn = options.warn || console.warn;
    var exclude = options.exclude;
    var sourceCoveragePromises = Object.keys(coverage).filter(function(filePath) {
        if (exclude && exclude(filePath)) {
            warn('Excluding: "' + filePath + '"');
            return false;
        }
        return true;
    }).map(function(filePath) {
        var fileCoverage = coverage[filePath];
        var fileSource = FileSource.create(filePath);

        return fileSource.prepare().then(function() {
            if (!fileSource.sourceMap) {
                warn(new Error('Could not find source map for: "' + filePath + '"'));
                return fileCoverage;
            }

            // now we have the sourcemap, apply it
            return remapFileCoverage(fileCoverage, fileSource);
        });
    });

    return Promise.all(sourceCoveragePromises).then(function(sourceCoverages) {
        var collector = new Collector();
        collector.add(sourceCoverages);

        /* refreshes the line counts for reports */
        // collector.getFinalCoverage();

        // return collector;
    });
}

export default remap;
