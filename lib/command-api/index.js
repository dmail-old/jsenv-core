function collectParams(signatureMap, parentParam) {
    var params = [];

    Object.keys(signatureMap).forEach(function(signatureName) {
        var signature = signatureMap[signatureName];
        var paramName;
        var param = {};

        if ('name' in signature) {
            paramName = signature.name;
        } else {
            paramName = signatureName;
        }
        if (parentParam && !parentParam.fn) {
            paramName = parentParam.name + '-' + paramName;
        }
        param.name = paramName;

        if ('default' in signature) {
            param.value = signature.default;
        }
        if ('type' in signature) {
            param.type = signature.type;
        }
        if ('params' in signature) {
            params.concat(collectParams(signature.params, param));
        }

        params.push(param);
    });

    return params;
}

function parseParam(source, defaultName) {
    var data = {};

    data.source = source;

    if (source[0] === '-') {
        var afterPrefix;
        if (source[1] === '-') {
            afterPrefix = source.slice(2);
        } else {
            afterPrefix = source.slice(1);
        }

        var equalCharIndex = afterPrefix.indexOf('=');
        if (equalCharIndex > -1) {
            data.name = afterPrefix.slice(0, equalCharIndex);
            data.value = afterPrefix.slice(equalCharIndex + 1);
        } else {
            data.name = afterPrefix;
        }
    } else {
        data.name = defaultName;
        data.value = source;
    }

    return data;
}

function collectCommandParams(commandParams) {
    return commandParams.map(function(string, index) {
        return parseParam(string, String(index));
    });
}

function commandApi(commandSignatures) {
    var params = collectParams(commandSignatures);

    params.get = function(name) {
        var possibleNames = [
            name,
            name,
            name[0]
        ];
        var param = null;
        var i = 0;
        var j = params.length;
        for (; i < j; i++) {
            param = params[i];
            if (possibleNames.indexOf(param.name) > -1) {
                break;
            } else {
                param = null;
            }
        }

        return param;
    };

    return {
        params: params,

        parse: function(commandParamSources) {
            if (typeof commandParamSources === 'string') {
                commandParamSources = [commandParamSources];
            }

            var commandParams = collectCommandParams(commandParamSources);
            var unknownCommandParams = commandParams.filter(function(commandParam) {
                var name = commandParam.name;
                var param = params.get(name);

                return !param;
            });
            if (unknownCommandParams.length) {
                var unknownCommandParamSources = unknownCommandParams.map(function(unknownCommandParam) {
                    return unknownCommandParam.source;
                });
                throw new Error('unknown params: ' + unknownCommandParamSources);
            }

            // set value of param
            commandParams.forEach(function(commandParam) {
                var name = commandParam.name;
                var param = params.get(name);

                if ('value' in commandParam) {
                    var value = commandParam.value;
                    if (param.type === 'boolean') {
                        value = Boolean(value);
                    } else if (param.type === 'number') {
                        value = Number(value);
                    }

                    param.value = value;
                }
            });

            // check param dependencies
            commandParams.forEach(function(commandParam) {
                var name = commandParam.name;

                if (name.indexOf('-') > -1) {
                    var parts = commandParam.name.split('-');
                    parts.pop();

                    // every parts must exists
                    parts.forEach(function(partName, index) {
                        var parentParamName = parts.slice(0, index).join('-');
                        if (!params.get(parentParamName)) {
                            throw new Error(commandParam.source + ' must be used with -' + parentParamName);
                        }
                    });
                }
            });
        },

        exec: function() {
            Object.keys(commandSignatures).forEach(function(signatureName) {
                var signature = commandSignatures[signatureName];
                var name = signature.name || signatureName;
                var param = params.get(name);

                if (param && signature.fn) {
                    if (param.type === 'Boolean' && param.value === false) {
                        // skip
                    } else {
                        var paramValues = {};
                        params.forEach(function(param) {
                            paramValues[param.name] = param.value;
                        });

                        signature.fn(paramValues);
                    }
                }
            });
        }
    };
}

module.exports = commandApi;

