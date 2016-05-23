// This is copied almost verbatim from the V8 source code at
// https://code.google.com/p/v8/source/browse/trunk/src/messages.js. The
// implementation of wrapCallSite() used to just forward to the actual source
// code of CallSite.prototype.toString but unfortunately a new release of V8
// did something to the prototype chain and broke the shim. The only fix I
// could find was copy/paste.

function stringify(callSite) {
    var fileName;
    var fileLocation = '';

    if (callSite.isNative()) {
        fileLocation = 'native';
    } else {
        fileName = callSite.getScriptNameOrSourceURL();
        if (!fileName && callSite.isEval()) {
            fileLocation = callSite.getEvalOrigin();
            fileLocation += ", "; // Expecting source position to follow.
        }

        if (fileName) {
            fileLocation += fileName;
        } else {
            // Source code does not originate from a file and is not native, but we
            // can still get the source position inside the source string, e.g. in
            // an eval string.
            fileLocation += "<anonymous>";
        }

        var lineNumber = callSite.getLineNumber();
        if (lineNumber !== null) {
            fileLocation += ":" + lineNumber;
            var columnNumber = callSite.getColumnNumber();
            if (columnNumber !== null) {
                fileLocation += ":" + columnNumber;
            }
        }
    }

    var line = '';
    var functionName = callSite.getFunctionName();
    var addSuffix = true;
    var isConstructor = callSite.isConstructor();
    var isMethodCall = !(callSite.isToplevel() || isConstructor);
    if (isMethodCall) {
        var typeName = callSite.getTypeName();
        var methodName = callSite.getMethodName();
        if (functionName) {
            if (typeName && functionName.indexOf(typeName) !== 0) {
                line += typeName + ".";
            }
            line += functionName;
            if (methodName && functionName.indexOf("." + methodName) !== functionName.length - methodName.length - 1) {
                line += " [as " + methodName + "]";
            }
        } else {
            line += typeName + "." + (methodName || "<anonymous>");
        }
    } else if (isConstructor) {
        line += "new " + (functionName || "<anonymous>");
    } else if (functionName) {
        line += functionName;
    } else {
        line += fileLocation;
        addSuffix = false;
    }
    if (addSuffix) {
        line += " (" + fileLocation + ")";
    }

    return line;
}

export default stringify;
