var rollup = require('rollup');
var fs = require('fs');

rollup.rollup({
    entry: 'main.js'
}).then(function(bundle) {
    // Generate bundle + sourcemap
    var result = bundle.generate({
        // output format - 'amd', 'cjs', 'es', 'iife', 'umd'
        format: 'iife',
        moduleName: 'moduleName',
        banner: '"banner";',
        intro: '"intro";',
        outro: '"outro";',
        footer: '"footer";'
    });

    fs.writeFileSync('main.rolluped.js', result.code);

    // Alternatively, let Rollup do it for you
    // (this returns a promise). This is much
    // easier if you're generating a sourcemap
    // bundle.write({
    //     format: 'cjs',
    //     dest: 'bundle.js'
    // });
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});
