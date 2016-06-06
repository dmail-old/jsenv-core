// https://github.com/SitePen/remap-istanbul/blob/master/lib/remap.js

import jsenv from 'jsenv';
import proto from 'env/proto';

import require from '@node/require';

var istanbul = require('istanbul');
var FileSource = jsenv.FileSource;

const RemappedSourceCoverage = proto.extend('RemappedSourceCoverage', {
    constructor(filename) {
        this.coverage = {
            path: filename,
            statementMap: {},
            fnMap: {},
            branchMap: {},
            s: {},
            b: {},
            f: {}
        };
        this.meta = {
            indexes: {},
            lastIndex: {
                s: 0,
                b: 0,
                f: 0
            }
        };
    }
});

const SourceCoverageRemapper = proto.extend('SourceCoverageRemapper', {
    constructor(key) {
        this.key = key;
        this.coverageMap = new Map();
    },

    getRemappedSourceCoverage(source) {
        var remappedSourceCoverage;

        if (this.coverageMap.has(source)) {
            remappedSourceCoverage = this.coverageMap.get(source);
        } else {
            remappedSourceCoverage = RemappedSourceCoverage.create(source);
            this.coverageMap.set(source, remappedSourceCoverage);
        }

        return remappedSourceCoverage;
    },

    getOriginalPosition(location) {
        return this.fileSource.getOriginalPosition(location);
    },

    getMapping(location) {
        /* jshint maxcomplexity: 11 */
        var start = this.getOriginalPosition(location.start);
        var end = this.getOriginalPosition(location.end);

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
            end = this.getOriginalPosition({
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
    },

    each(object, fn) {
        Object.keys(object).forEach(function(key) {
            fn(object[key], key, object);
        });
        return object;
    },

    remapFns(sourceCoverage) {
        this.each(sourceCoverage.fnMap, function(genItem, key) {
            var mapping = this.getMapping(genItem.loc);
            if (!mapping) {
                return;
            }

            var hits = sourceCoverage.f[key];
            var remappedSourceCoverage = this.getRemappedSourceCoverage(mapping.source);
            var data = remappedSourceCoverage.data;
            var meta = remappedSourceCoverage.meta;
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
    },

    remapStatements(sourceCoverage) {
        this.each(sourceCoverage.statementMap, function(genItem, key) {
            var mapping = this.getMapping(genItem);
            if (!mapping) {
                return;
            }

            var hits = sourceCoverage.s[key];
            var remappedSourceCoverage = this.getRemappedSourceCoverage(mapping.source);
            var data = remappedSourceCoverage.data;
            var meta = remappedSourceCoverage.meta;

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
        }, this);
    },

    remapBranches(sourceCoverage) {
        this.each(sourceCoverage.branchMap, function(genItem, key) {
            var locations = [];
            var source;
            var originalKey = ['b'];

            var mappings = genItem.locations.map(function(location) {
                return this.getMapping(location);
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

            var hits = sourceCoverage.b[key];
            var remappedSourceCoverage = this.getRemappedSourceCoverage(source);
            var data = remappedSourceCoverage.data;
            var meta = remappedSourceCoverage.meta;

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
    },

    remap(sourceCoverage) {
        this.fileSource = FileSource.create(sourceCoverage.path);

        return this.fileSource.prepare().then(function() {
            if (this.fileSource.sourceMap) {
                this.remapFns(sourceCoverage);
                this.remapStatements(sourceCoverage);
                this.remapBranches(sourceCoverage);
            } else {
                console.warn(new Error('Could not find source map for: "' + sourceCoverage.path + '"'));
                this.remappedCoverages[this.key] = sourceCoverage;
            }
        }.bind(this));
    }
});

const ConverageRemapper = proto.extend('ConverageRemapper', {
    constructor(options) {
        this.options = options;
    },

    remap(coverage) {
        var coverageKeys = Object.keys(coverage);
        var exclude;

        if (exclude) {
            coverageKeys = coverageKeys.filter(function(fileName) {
                if (exclude(fileName)) {
                    console.warn('Excluding: "' + fileName + '"');
                    return false;
                }
                return true;
            });
        }

        // create a sourceCoverageRemapper for each
        var sourceCoverageRemappers = coverageKeys.map(function(key) {
            return SourceCoverageRemapper.create(key);
        });

        // remap all sourceCoverage
        var sourceCoveragePromises = sourceCoverageRemappers.map(function(sourceCoverageRemapper) {
            return sourceCoverageRemapper.remap(coverage[sourceCoverageRemapper.key]);
        });

        // get the remapped coverage (one sourceCoverage can create many remapped sourceCoverage)
        return Promise.all(sourceCoveragePromises).then(function() {
            var sourceCoverages = [];

            for (let sourceCoverageRemapper of sourceCoverageRemappers) {
                for (let sourceCoverage of sourceCoverageRemapper.coverageMap.values()) {
                    sourceCoverages.push(sourceCoverage);
                }
            }

            return sourceCoverages;
        });
    }
});

function remap(coverage, options) {
    options = options || {};

    var remapper = ConverageRemapper.create();

    remapper.remap(coverage).then(function(sourceCoverages) {
        var collector = new istanbul.Collector();

        for (let sourceCoverage of sourceCoverages) {
            collector.add(sourceCoverage);
        }

        /* refreshes the line counts for reports */
        var updatedSourceCoverages = collector.getFinalCoverage();

        return {
            collector: collector,
            coverage: updatedSourceCoverages
        };
    });
}

export default remap;
