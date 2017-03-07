function mapAsync(iterable, fn) {
    return Promise.all(iterable.map(fn));
}

module.exports = mapAsync;
