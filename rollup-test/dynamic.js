/*
il manque le fait qu'on doit savoir la liste des dépendance d'une feature pour plusieurs raisons :

on peut run les test dans le bon ordre
on peut fail le test si une dépendance fail

si on ne connait pas cette liste on ne peut pas faire ça
-> on retournera dependencies: []

il manque encore le fait qu'on pouvait hériter de run/solution de son parent
-> on peut "juste" faire solution: parent.solution et run: parent.run

il manque le fait qu'on utilisait parent pour trouver le solutionOwner
-> on peut parcourir les feature qu'on utilise et ne garde que les objet solution unique (non shared)

comment donner au client le build corejs à éxécuter ?

*/

function generateSourceImporting() {
    var importDescriptions = arguments;
    var i = 0;
    var j = importDescriptions.length;
    var importSources = [];
    var collectorSources = [];
    while (i < j) {
        var importDescription = importDescriptions[i];
        var importInstructions = importDescription.import.split(',').map(function(name) { // eslint-disable-line
            name = name.trim();
            return {
                name: name,
                as: name + '$' + i
            };
        });

        var importSource = '';
        importSource += 'import {';
        importSource += importInstructions.map(function(importInstruction) {
            return importInstruction.name + ' as ' + importInstruction.as;
        }).join(', ');
        importSource += '}';
        importSource += ' from ';
        importSource += "'" + importDescription.from + "'";
        importSource += ';';
        importSources.push(importSource);

        var collectorSource = '';
        collectorSource += 'collector.push({';
        collectorSource += importInstructions.map(function(importInstruction) {
            return '"' + importInstruction.name + '": ' + importInstruction.as;
        }).join(', ');
        collectorSource += '});';
        collectorSources.push(collectorSource);
        i++;
    }

    return (
        importSources.join('\n') +
        '\n\n' +
        'var collector = [];' +
        '\n' +
        collectorSources.join('\n') +
        '\n' +
        'export default collector;'
    );
}

var fs = require('fs');
var rollup = require('rollup');
var babel = require('babel-core');
var path = require('path');
var here = __dirname.replace(/\\/g, '/');
function pickImports() {
    var moduleSource = generateSourceImporting.apply(null, arguments);

    fs.writeFileSync('./tmp/index.js', moduleSource);

    return rollup.rollup({
        entry: './tmp/index.js',
        plugins: [
            {
                name: 'name',
                resolveId: function(importee, importer) {
                    console.log('resolveId', importee, importer);

                    // importer is the path of the file importing importee
                    if (importee === 'helper/detect') {
                        return path.resolve('./helper/detect.js');
                    }
                    if (importee === 'helper/fix') {
                        return path.resolve('./helper/fix.js');
                    }

                    if (importer) {
                        return path.resolve(here, importee);
                    }
                },
                transform: function(code) {
                    console.log('transforming');
                    const transformed = babel.transform(code, {
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
                            'transform-es2015-destructuring',
                            function() {
                                return {
                                    visitor: {
                                        TaggedTemplateExpression: function() {
                                            console.log('visitor');
                                        }
                                    }
                                };
                            }
                        ]
                    });

                    return {
                        code: transformed.code,
                        map: transformed.map
                    };
                }
            }
        ]
    }).then(function(bundle) {
        // Generate bundle + sourcemap
        var result = bundle.generate({
            // output format - 'amd', 'cjs', 'es', 'iife', 'umd'
            format: 'iife',
            moduleName: 'collector',
            indent: true,
            // banner: '"banner";',
            intro: '"intro";',
            outro: '"outro";',
            footer: 'collector;'
        });

        fs.writeFileSync('./tmp/index.js.rolluped.js', result.code);
        return result.code;
    });
}

pickImports(
    {'import': 'default', from: './feature.js'}
).then(eval).then(function(exports) {
    console.log(exports);
}).catch(function(e) {
    setTimeout(function() {
        throw e;
    });
});

