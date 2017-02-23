feature.polyfill(startsWith);

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
function startsWith(searchString, position) {
    var string = String(this);
    position = position || 0;
    return string.substr(position, searchString.length) === searchString;
}
