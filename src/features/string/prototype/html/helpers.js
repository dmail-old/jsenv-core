function expectLowerCaseAndAttribute(method, pass, fail) {
    var html = method.call('', '"');
    if (html !== html.toLowerCase()) {
        return fail('html-contains-uppercase');
    }
    if (html.split('"').length > 3) {
        return fail('html-incorrect');
    }
    return pass();
}
export {expectLowerCaseAndAttribute};

import {objectIsCoercible} from '/fix-helpers.js';
const quoteRegexp = /"/g;
function createHTML(firstArg, tag, attribute, value) {
    objectIsCoercible(firstArg);
    var string = String(firstArg);
    var openingTag = tag;
    if (attribute) {
        openingTag += ' ' + attribute + '="' + String(value).replace(quoteRegexp, '&quot;') + '"';
    }
    return '<' + openingTag + '>' + string + '</' + tag + '>';
}
export {createHTML};
