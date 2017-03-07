var createTranspiler = require('./transpiler.js');

var featureTranspiler = createTranspiler({
    cache: true,
    cacheMode: 'write-only',
    // filename: false,
    sourceURL: false,
    sourceMaps: false,
    plugins: [
        'transform-es3-property-literals',
        'transform-es3-member-expression-literals',
        'transform-es2015-shorthand-properties',
        'transform-es2015-block-scoping',
        'transform-es2015-arrow-functions',
        [
            'transform-es2015-template-literals',
            {
                loose: true // because we may not have Object.freeze
            }
        ],
        [
            'transform-es2015-spread',
            {
                loose: true // because we may not have Symbol.iterator etc
            }
        ],
        'transform-es2015-destructuring'
    ]
});

module.exports = featureTranspiler;
