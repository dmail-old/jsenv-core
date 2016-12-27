// import proto from 'proto';

import Comparer from './src/comparer.js';

function defaultCompare(a, b) {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
}

function getSortIndex(array, item, compare) {
    compare = compare || defaultCompare;

    let length = array.length;
    let order;
    let i = length;
    let toTheRightOfItemIndex = -1;
    while (i--) {
        order = compare(array[i], item);

        // order > 0 means the item must be to the right of the current one
        if (order > 0) {
            toTheRightOfItemIndex = i;
        } else if (order === 0) {
            // order === 0 means the item is equivalent to the current one, it could be to it's right or left
            // we force item to be to the right of the first equivalent item only, next equivalent item are ignored
            if (toTheRightOfItemIndex === -1) {
                toTheRightOfItemIndex = i + 1;
            }
        } else if (toTheRightOfItemIndex !== -1) {
            // else we know item must be to the left of the current one
            // so toTheRightOfItemIndex was set we know item index is the one
            break;
        }
    }

    if (toTheRightOfItemIndex === -1) {
        toTheRightOfItemIndex = length;
    }

    return toTheRightOfItemIndex;
}

function addItemInSortedArray(array, item, compare) {
    array.splice(getSortIndex(array, item, compare), 0, item);
}

function moveItemInArray(array, fromIndex, toIndex) {
    fromIndex = parseInt(fromIndex, 10);
    toIndex = parseInt(toIndex, 10);

    if (fromIndex !== toIndex) {
        var i;
        var j;
        var value;

        if (fromIndex < toIndex) {
            i = fromIndex;
            j = toIndex;
        } else {
            i = toIndex;
            j = fromIndex;
        }

        if (i >= 0 && j <= array.length) {
            value = array[i];
            while (i !== j) {
                array[i] = array[i + 1];
                i++;
            }
            array[j] = value;
        }
    }
}

function updateIndexInSortedArray(array, index, compare) {
    let sortedIndex = getSortIndex(array, array[index], compare);

    moveItemInArray(array, index, sortedIndex);
}

const SortedArray = {
    defaultCompare: defaultCompare,
    getSortIndex: getSortIndex,
    add: addItemInSortedArray,
    move: moveItemInArray,
    update: updateIndexInSortedArray,
    sortBy(array, ...args) {
        var comparer = Comparer.create(...args);
        return array.sort(comparer.compare);
    },
    createComparer(...args) {
        return Comparer.create(...args);
    },

    create(compare) {
        let array = [];

        Object.keys(this.properties).forEach(function(propertyName) {
            Object.defineProperty(array, propertyName, {
                configurable: true,
                enumerable: false,
                value: this.properties[propertyName]
            });
        }, this);
        if (compare) {
            Object.defineProperty(array, 'compare', {
                configurable: true,
                enumerable: false,
                value: compare
            });
        }

        return array;
    },

    properties: {
        compare: defaultCompare,
        autoSort: true,

        disableAutoSort() {
            this.autoSort = false;
        },

        enableAutoSort() {
            this.autoSort = true;
        },

        add(item) {
            if (this.autoSort) {
                addItemInSortedArray(this, item, this.compare);
            } else {
                this.push(item);
            }
            return this;
        },

        update() {
            let sortedArray = this.sort(this.compare);
            let i = this.length;
            while (i--) {
                this[i] = sortedArray[i];
            }
            return this;
        },

        updateIndex(index) {
            updateIndexInSortedArray(this, index, this.compare);
            return this;
        }
    }
};

export default SortedArray;

export const test = {
    modules: ['@node/assert'],

    main(assert) {
        function compare(a, b) {
            return a - b;
        }

        function assertIndexIs(array, item, index, message) {
            assert.equal(SortedArray.getSortIndex(array, item, compare), index, message);
        }

        this.add("getSortIndex() return the index to insert an item in a sorted array", function() {
            assertIndexIs([16], 0, 0);
            assertIndexIs([0], 30, 1);
            assertIndexIs([0, 2], 1, 1);
            assertIndexIs([3, 4], 5, 2);
            assertIndexIs([5, 6], 4, 0);

            assertIndexIs([0, 0, 2], 1, 2);
            assertIndexIs([2, 2, 3], 1, 0);

            assertIndexIs([0, 2, 2], 1, 1);
            assertIndexIs([0, 2, 2], 3, 3);

            assertIndexIs([0, 2, 2, 3, 3], 2, 3);

            assertIndexIs([0, 0], 0, 2);
            assertIndexIs([1, 1], 0, 0);
        });

        this.add("getSortIndex() must always return most right index for equivalent item", function() {
            var userA = {name: 'damien'};
            var userB = {name: 'damien'};
            // var userC = {name: 'zamien'};
            var userList = [userA, userB];

            var userEquivalentToAAndB = {name: 'damien'};

            var sortIndex = SortedArray.getSortIndex(userList, userEquivalentToAAndB, function(a, b) {
                return a.name - b.name;
            });

            assert.equal(sortIndex, 2);
        });

        this.add("create()", function() {
            let sortedArray = SortedArray.create(function(a, b) {
                return b - a;
            });

            sortedArray.push(1, 0, 2);

            assert.deepEqual(sortedArray.update(), [2, 1, 0]);
        });
    }
};
