function find(iterable, fn, bind) {
    var i = 0;
    var j = iterable.length;
    var found = null;
    while (i < j) {
        found = iterable[i];
        if (fn.call(bind, found, i, iterable)) {
            break;
        }
        found = null;
        i++;
    }
    return found;
}

module.exports = find;
