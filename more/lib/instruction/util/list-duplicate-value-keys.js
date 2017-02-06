function listDuplicateValueKeys(object, first, compare) {
    var propertyNames = Object.keys(object);
    var i = 0;
    var j = propertyNames.length;
    var k;
    var propertyName;
    var firstValue;
    var secondValue;
    var duplicatePropertyName;
    var duplicateValueKeyList = [];
    var duplicateValueCount = 0;

    for (;i < j; i++) {
        propertyName = propertyNames[i];
        firstValue = object[propertyName];

        k = i;
        for (;k < j; k++) {
            if (k !== i) {
                duplicatePropertyName = propertyNames[k];
                secondValue = object[duplicatePropertyName];

                if ((compare && compare(firstValue, secondValue)) || firstValue === secondValue) {
                    if (duplicateValueCount === 0) {
                        duplicateValueKeyList[duplicateValueCount++] = propertyName;
                    }
                    duplicateValueKeyList[duplicateValueCount++] = duplicatePropertyName;
                    if (first) {
                        break;
                    }
                }
            }
        }

        // si on matche une fois on laisse tomber les éventuelles autres répétition
        if (duplicateValueCount > 0) {
            break;
        }
    }

    return duplicateValueKeyList; // duplicateValueCount > 0 ? duplicateValueKeyList : false;
}

function listFirstDuplicateValueKeys(object, compare) {
    return listDuplicateValueKeys(object, true, compare);
}

function listAllDuplicateValueKeys(object, compare) {
    return listDuplicateValueKeys(object, false, compare);
}

export default listAllDuplicateValueKeys;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        function assertKeys(object, keys, compare) {
            assert.equal(listFirstDuplicateValueKeys(object, compare).join(), keys.join());
        }

        this.add("returns array of duplicate propertynames", function() {
            assertKeys(['a', 'b', 'a'], [0, 2]);
            assertKeys(['a', 'b', 'b', 'a'], [0, 3]);

            assertKeys([{name: 'foo'}, {name: 'damien'}, {name: 'bar'}, {name: 'damien'}], [1, 3], function(a, b) {
                return a.name === b.name;
            });
        });
    }
};
