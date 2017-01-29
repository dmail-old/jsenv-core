/*
var users = [
    {
        name: 'dam',
        match: function() {
            return Promise.resolve(false);
        }
    },
    {
        name: 'sandra',
        match: function() {
            return Promise.resolve(true);
        }
    }
];

findAsync(users, function(user) {
    return user.match();
}).then(function(user) {
    user.name; // 'sandra'
});
*/
function findAsync(iterable, fn) {
    var i = -1;
    var j = iterable.length;
    function next() {
        i++;
        if (i === j) {
            return null;
        }

        var entry = iterable[i];
        return Promise.resolve(fn(entry, i, iterable)).then(function(value) {
            if (value) {
                return entry;
            }
            return next();
        });
    }

    if (j === 0) {
        return Promise.resolve(null);
    }
    return next();
}

/*
toPromiseResult(function() { return true; }).then(function(result) { result == {status: 'resolved', value: true}; });
toPromiseResult(function() { throw 'foo'; }).then(function(result) { result == {status: 'rejected', value: 'foo'}; });
toPromiseResult(function() { return Promise.resolve(); }).then(function(result) { result == {status: 'resolved', value: undefined}; });
*/
function toPromiseResult(fn, bind, args) {
    var hasThrowed = false;
    var throwedValue;
    var returnValue;

    try {
        returnValue = fn.apply(bind, args);
    } catch (e) {
        hasThrowed = true;
        throwedValue = e;
    }

    var resultPromise;
    if (hasThrowed) {
        resultPromise = Promise.reject(throwedValue);
    } else if (returnValue && 'then' in returnValue && typeof returnValue.then === 'function') {
        resultPromise = returnValue;
    } else {
        resultPromise = Promise.resolve(returnValue);
    }

    var result = {};
    return resultPromise.then(
        function(value) {
            result.status = 'resolved';
            result.value = value;
            return result;
        },
        function(value) {
            result.status = 'rejected';
            result.value = value;
            return result;
        }
    );
}
