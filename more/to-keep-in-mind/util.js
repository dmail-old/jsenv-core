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

// function compileFunction(names, body) {
//     var args = [];
//     args.push.apply(args, names);
//     args.push(body);
//     return jsenv.construct(Function, args);
// }
// function extractFunctionBodyComment(fn) {
//     return fn.toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];
// }
// function camelToHyphen(string) {
//     var i = 0;
//     var j = string.length;
//     var camelizedResult = '';
//     while (i < j) {
//         var letter = string[i];
//         var action;

//         if (i === 0) {
//             action = 'lower';
//         } else if (isUpperCaseLetter(letter)) {
//             if (isUpperCaseLetter(string[i - 1])) { // toISOString -> to-iso-string & toJSON -> to-json
//                 if (i === j - 1) { // toJSON on the N
//                     action = 'lower';
//                 } else if (isLowerCaseLetter(string[i + 1])) { // toISOString on the S
//                     action = 'camelize';
//                 } else { // toJSON on the SO
//                     action = 'lower';
//                 }
//             } else if (
//                 isLowerCaseLetter(string[i - 1]) &&
//                 i > 1 &&
//                 isUpperCaseLetter(string[i - 2])
//             ) { // isNaN -> is-nan
//                 action = 'lower';
//             } else {
//                 action = 'camelize';
//             }
//         } else {
//             action = 'concat';
//         }

//         if (action === 'lower') {
//             camelizedResult += letter.toLowerCase();
//         } else if (action === 'camelize') {
//             camelizedResult += '-' + letter.toLowerCase();
//         } else if (action === 'concat') {
//             camelizedResult += letter;
//         } else {
//             throw new Error('unknown camelize action');
//         }

//         i++;
//     }
//     return camelizedResult;
// }
// function isUpperCaseLetter(letter) {
//     return /[A-Z]/.test(letter);
// }
// function isLowerCaseLetter(letter) {
//     return /[a-z]/.test(letter);
// }
// function ensureKind(expectedKind) {
//     return function(result, settle) {
//         var actualKind;

//         if (expectedKind === 'object' && result === null) {
//             actualKind = 'null';
//         } else if (expectedKind === 'symbol') {
//             if (result && result.constructor === Symbol) {
//                 actualKind = 'symbol';
//             } else {
//                 actualKind = typeof result;
//             }
//         } else {
//             actualKind = typeof result;
//         }

//         if (actualKind === expectedKind) {
//             settle(true, 'expected-' + actualKind);
//         } else {
//             settle(false, 'unexpected-' + actualKind);
//         }
//     };
// }
// function composeSettlers(settlers) {
//     return function() {
//         var i = 0;
//         var j = settlers.length;
//         var statusValid;
//         var statusReason;
//         var statusDetail;
//         var handledCount = 0;
//         var args = Array.prototype.slice.call(arguments);
//         var lastArgIndex = args.length - 1;
//         var settle = args[lastArgIndex];

//         function compositeSettle(valid, reason, detail) {
//             handledCount++;

//             statusValid = valid;
//             statusReason = reason;
//             statusDetail = detail;

//             var settled = false;
//             if (statusValid) {
//                 settled = handledCount === j;
//             } else {
//                 settled = true;
//             }

//             if (settled) {
//                 settle(statusValid, statusReason, statusDetail);
//             }
//         }

//         args[lastArgIndex] = compositeSettle;

//         while (i < j) {
//             settlers[i].apply(this, args);
//             if (statusValid === false) {
//                 break;
//             }
//             i++;
//         }
//     };
// }
