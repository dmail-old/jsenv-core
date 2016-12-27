function matchLocation(location) {
    return location.match(/^(.+):(\d+):(\d+)$/);
}

function createLocationFromMatch(match) {
    var fileName = match[1];

    if (fileName === '<anonymous>') {
        fileName = null;
    }

    return {
        fileName: fileName,
        lineNumber: parseInt(match[2], 10),
        columnNumber: parseInt(match[3], 10)
    };
}

function parseLocation(location) {
    return createLocationFromMatch(matchLocation(location));
}

function assignLocation(properties, location) {
    properties.fileName = location.fileName;
    properties.lineNumber = location.lineNumber;
    properties.columnNumber = location.columnNumber;
}

function assignEvalLocation(properties, location) {
    properties.evalFileName = location.fileName;
    properties.evalLineNumber = location.lineNumber;
    properties.evalColumnNumber = location.columnNumber;
}

function mapEvalOrigin(parts) {
    var location = parts.location;

    if (location.indexOf('eval at ') === 0) {
        var evalMatch = location.match(/^eval at ([^ ]+) \((.+)?\)$/);

        parts.name = evalMatch[1];
        parts.location = evalMatch[2];
        mapEvalOrigin(parts);
    }
}

function parseEval(location) {
    var parts = {};
    var match = location.match(/^eval at ([^ ]+) \((.+)?\), (.+)$/);

    parts.name = match[1];
    parts.location = match[2];
    parts.origin = match[3];

    mapEvalOrigin(parts);

    return parts;
}

var regexps = {
    parts: /^(.+?) (?:\((.+)\))?$/
};

function parse(line) {
    if (typeof line !== 'string') {
        throw new TypeError('string expected');
    }

    var properties = {};
    var match;

    if (line.match(/^\s*[-]{4,}$/)) {
        properties.fileName = line;
    } else {
        line = line.replace(/^\s*at\s+/, '');
        match = matchLocation(line);

        if (match) {
            assignLocation(properties, createLocationFromMatch(match));
        } else {
            match = line.match(regexps.parts);
            if (match) {
                var callNames = match[1];
                var callLocation = match[2];

                if (callNames) {
                    if (callNames.indexOf('new ') === 0) {
                        properties.fromConstructor = true;
                        callNames = callNames.slice('new '.length);
                    }

                    var names = callNames.match(/^(\w+)?(?:\.([^\]]+)(?: \[as (.+)?\])?)?$/);

                    // properties.functionName = callNames;

                    if (names) {
                        if (!names[2] && !names[3]) {
                            properties.functionName = callNames;
                        } else {
                            properties.methodName = names[2];
                            properties.functionName = names[3];

                            if (properties.methodName) {
                                if (properties.methodName === '(anonymous function)') {
                                    properties.methodName = null;
                                }

                                properties.typeName = names[1];
                            } else {
                                properties.typeName = 'Object';
                            }
                        }
                    }
                }

                if (callLocation === '<anonymous>') {
                    callLocation = null;
                }

                if (callLocation) {
                    // CallLocation examples
                    // eval at <anonymous> (C:\Users\Damien\Documents\GitHub\source-ap-node-error\test.js:4:2), <anonymous>:1:1
                    // module.js:460:26

                    if (callLocation === 'native') {
                        properties.fromNative = true;
                    } else {
                        var location;

                        if (callLocation.indexOf('eval at ') === 0) {
                            var evalParts = parseEval(callLocation);
                            // var evalName = evalParts.name;
                            var evalLocation = parseLocation(evalParts.origin);

                            location = parseLocation(evalParts.location);

                            properties.fromEval = true;
                            assignLocation(properties, location);
                            assignEvalLocation(properties, evalLocation);
                        } else if (properties.functionName === 'eval') {
                            location = parseLocation(callLocation);

                            assignLocation(properties, location);
                            assignEvalLocation(properties, location);
                        } else {
                            location = parseLocation(callLocation);

                            assignLocation(properties, location);
                        }
                    }
                }

                if (properties.functionName === 'eval') {
                    properties.fromEval = true;
                }

                if (properties.methodName === '<anonymous>') {
                    properties.methodName = null;
                    properties.functionName = '';
                }
            }
        }
    }

    if ('fileName' in properties) {
        var fileName = properties.fileName;
        if (fileName.indexOf('file:///') !== 0 && fileName.match(/^[a-zA-Z]:[^<>:"|*]+$/)) {
            properties.fileName = 'file:///' + fileName;
        }

        properties.fileName = properties.fileName.replace(/\\/g, '/');
    }

    return properties;
}

export default parse;
