import {transpile, expect, sameValues, createIterableObject} from 'helper/detect.js';
import parent from '../feature.js';
import iterableDependency from '//iterable-behaviour/feature.js';

const feature = {
    dependencies: [parent, iterableDependency],
    run: transpile`(function(value) {
        const result = value;
        return result;
    })`,
    test: expect(function(fn) {
        var data = [1, 2, 3];
        var iterable = createIterableObject(data);
        var result = fn(iterable);
        return sameValues(result, data);
    }),
    solution: parent.solution
};

export default feature;
