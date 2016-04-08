function collectParams(signatureMap, parentParam) {
    var params = [];

    Object.keys(signatureMap).forEach(function(signatureName) {
        var signature = signatureMap[signatureName];
        var paramName;
        var param = {};

        params.push(param);

        if ('name' in signature) {
            paramName = signature.name;
        } else {
            paramName = signatureName;
        }
        if (parentParam && !parentParam.main && isNaN(parentParam.name)) {
            paramName = parentParam.name + '-' + paramName;
        }
        param.name = paramName;

        if ('default' in signature) {
            param.value = signature.default;
        }
        if ('type' in signature) {
            param.type = signature.type;
        }
        if ('fn' in signature) {
            param.fn = signature.fn;
        }
        if ('main' in signature) {
            param.main = signature.main;
        }
        if ('params' in signature) {
            params = params.concat(collectParams(signature.params, param));
        }
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
        data.name = String(defaultName);
        data.value = source;
    }

    return data;
}

function commandApi(commandSignatures) {
    var params = collectParams(commandSignatures);

    params.get = function(name) {
        name = String(name);
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

    params.populate = function(paramSource, defaultName) {
        var commandParam = parseParam(paramSource, defaultName);
        var name = commandParam.name;
        var param = params.get(name);
        if (!param) {
            throw new Error('unknow param: ' + paramSource);
        }

        if ('value' in commandParam) {
            var value = commandParam.value;
            if (param.type === 'boolean') {
                value = Boolean(value);
            } else if (param.type === 'number') {
                value = Number(value);
            }

            param.value = value;
        }

        if (name.indexOf('-') > -1) {
            var parts = name.split('-');
            parts.pop();

            // every parts must exists
            parts.forEach(function(partName, index) {
                // console.log('parts', parts);
                var parentParamName = parts.slice(0, index + 1).join('-');
                if (!params.get(parentParamName)) {
                    throw new Error(paramSource + ' must be used with -' + parentParamName);
                }
            });
        }
    };

    params.setAll = function(paramSources) {
        paramSources.forEach(function(paramSource, index) {
            params.populate(paramSource, String(index));
        });
    };

    params.toValues = function() {
        var values = {};

        params.forEach(function(param) {
            values[param.name] = param.value;
        });

        return values;
    };

    params.match = function() {
        var i = 0;
        var j = params.length;
        var param = null;
        for (;i < j; i++) {
            param = params[i];
            if (param && 'value' in param) {
                if (param.type === 'boolean' && param.value === false) {
                    param = null;
                } else {
                    break;
                }
            }
            param = null;
        }
        return param;
    };

    params.exec = function(paramSources) {
        this.setAll(paramSources);
        var command = this.match();
        return command.fn(this.toValues());
    };

    return params;
}

module.exports = commandApi;

