/*
add an option for param alias
*/

function parseSignature(signatureMap, parentParam) {
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
        if ('alias' in signature) {
            param.alias = signature.alias;
        }
        if ('params' in signature) {
            params = params.concat(parseSignature(signature.params, param));
        }
    });

    return params;
}

function parseParams(source, defaultName) {
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
    var params = parseSignature(commandSignatures);

    params.get = function(name) {
        name = String(name);
        var param = null;
        var i = 0;
        var j = this.length;
        for (; i < j; i++) {
            param = this[i];
            if (param.name === name) {
                break;
            }
            var alias = param.alias;
            if (alias && alias.split(',').indexOf(param.name) > -1) {
                break;
            }

            param = null;
        }

        return param;
    };

    params.populate = function(paramSource, defaultName) {
        var commandParam = parseParams(paramSource, defaultName);
        var name = commandParam.name;
        var param = this.get(name);
        if (!param) {
            throw new Error('unknow param: ' + paramSource);
        }

        if ('value' in commandParam) {
            var value = commandParam.value;
            if (param.type === 'boolean') {
                value = Boolean(value);
            } else if (param.type === 'number') {
                value = Number(value);
            } else if (param.type === 'array') {
                var possibleValues = param.enum;
                if (possibleValues && possibleValues.includes(value) === false) {
                    throw new Error(name + ' param value must be one of ' + possibleValues + ' (not' + value + ')');
                }

                if (Array.isArray(param.value)) {
                    if (!possibleValues || !possibleValues.includes(value)) {
                        param.value.push(value);
                    }
                    value = param.value;
                } else {
                    value = [value];
                }
            }

            param.value = value;
        } else if (param.type === 'boolean') {
            param.value = true;
        }

        if (name.indexOf('-') > -1) {
            var parts = name.split('-');
            parts.pop();

            // every parts must exists
            parts.forEach(function(partName, index) {
                // console.log('parts', parts);
                var parentParamName = parts.slice(0, index + 1).join('-');
                if (!this.get(parentParamName)) {
                    throw new Error(paramSource + ' must be used with -' + parentParamName);
                }
            }, this);
        }
    };

    params.setAll = function(paramSources) {
        paramSources.forEach(function(paramSource, index) {
            this.populate(paramSource, String(index));
        }, this);
    };

    params.toValues = function() {
        var values = {};

        this.forEach(function(param) {
            if (param.alias) {
                param.alias.split(',').forEach(function(alias) {
                    values[alias] = param.value;
                });
            }
            values[param.name] = param.value;
        });

        return values;
    };

    params.match = function() {
        var i = 0;
        var j = this.length;
        var param = null;
        for (;i < j; i++) {
            param = this[i];
            if (param && 'value' in param && 'fn' in param) {
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
        var result;
        if (command) {
            result = command.fn(this.toValues());
        } else {
            console.warn('command signature not found');
        }
        return result;
    };

    return params;
}

module.exports = commandApi;

