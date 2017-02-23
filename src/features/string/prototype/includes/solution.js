feature.polyfill(includes);

function includes(search, start) {
    var string = String(this);
    if (typeof start !== 'number') {
        start = 0;
    }

    if (start + search.length > string.length) {
        return false;
    }
    return string.indexOf(search, start) !== -1;
}
