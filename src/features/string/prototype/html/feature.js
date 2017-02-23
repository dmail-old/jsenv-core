expose(
    {
        meta: {
            createHTML: createHTML,
            testHTMLMethod: function(method, settle) {
                var html = method.call('', '"');
                if (html !== html.toLowerCase()) {
                    settle(false, 'return-html-has-uppercase');
                    return false;
                }
                if (html.split('"').length > 3) {
                    settle(false);
                    return false;
                }
                settle(true);
                return true;
            }
        }
    }
);

var quoteRegexp = /"/g;
function createHTML(firstArg, tag, attribute, value) {
    if (firstArg === undefined) {
        throw new TypeError("Can't call method on " + firstArg);
    }
    var string = String(firstArg);
    var openingTag = tag;
    if (attribute) {
        openingTag += ' ' + attribute + '="' + String(value).replace(quoteRegexp, '&quot;') + '"';
    }
    return '<' + openingTag + '>' + string + '</' + tag + '>';
}
