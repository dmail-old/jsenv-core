feature.polyfill(endsWith);

// https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/String/endsWith
function endsWith(searchString, position) {
    var subjectString = String(this);
    if (
        typeof position !== 'number' ||
        !isFinite(position) ||
        Math.floor(position) !== position ||
        position > subjectString.length
    ) {
        position = subjectString.length;
    }
    position -= searchString.length;
    var lastIndex = subjectString.lastIndexOf(searchString, position);
    return lastIndex !== -1 && lastIndex === position;
}
