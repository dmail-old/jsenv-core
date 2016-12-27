var regexpTrace = /\n\s+(at[\s\S]+)/;

function parse(stack) {
    // var match;
    var parts = {
        name: '',
        message: '',
        trace: ''
    };
    if (stack) {
        var traceMatch = regexpTrace.exec(stack);
        var traceIndex;
        var messageIndex = stack.indexOf(': ');

        if (traceMatch) {
            traceIndex = traceMatch.index;
        } else {
            traceIndex = stack.length;
        }

        if (messageIndex > -1) {
            parts.name = stack.slice(0, messageIndex);
            parts.message = stack.slice(messageIndex + 2, traceIndex);
        } else {
            parts.name = stack.slice(0, traceIndex);
        }

        parts.trace = stack.slice(traceIndex);
    }

    return parts;
}

export default parse;
