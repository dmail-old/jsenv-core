// - do not hardcode !transpiled
// - I do not unescape(encodeURIComponent()) the base64 string, what are the consequences?
// -> apparently it's ok with the custom base64 encode according to mozilla documentation

import base64 from 'env/base64';

import require from '@node/require';

const istanbul = require('istanbul');

function instrument(coverageGlobalName, sourceURL, sourceContent) {
    var instrumenter = new istanbul.Instrumenter({
        coverageVariable: coverageGlobalName
    });

    var sourcePath;
    if (sourceURL.indexOf('file:///') === 0) {
        sourcePath = sourceURL.slice('file:///'.length);
    } else {
        sourcePath = sourceURL;
    }

    sourcePath += '!transpiled'; // hardcoded for now but should be added only if there is a sourcemap on sourceContent

    // https://github.com/estools/escodegen/wiki/Source-Map-Usage
    instrumenter.opts.codeGenerationOptions = {
        sourceMap: sourcePath, // il faut passer le fichier d'origine, sauf que ce fichier n'est pas dispo sur le fs puisque transpiled
        sourceContent: sourceContent,
        sourceMapWithCode: true,
        file: sourcePath
    };
    //
    // tod: put this to true if the instrumented module is anonymous
    // a way to know if the module is register anonymously doing System.module is to check if it's adress looks like
    // '<Anonymous Module ' + ++anonCnt + '>';
    // https://github.com/ModuleLoader/es6-module-loader/issues/489
    // but if the anonymous module provide an adresse you're fucked and if a normal module use <Anonymous Module 1>
    // you would register it by mistake
    // for now we will enable embedSource if the load.address includes anonymous somewhere
    if (sourcePath.includes('anonymous')) {
        instrumenter.opts.embedSource = true;
    } else {
        instrumenter.opts.embedSource = false;
    }

    // https://github.com/karma-runner/karma-coverage/pull/146/files

    var instrumentedSource = instrumenter.instrumentSync(sourceContent, sourcePath);
    var instrumentedSourceMapString = instrumenter.lastSourceMap().toString();

    // I suppose it's a way to merge sourcemap into one
    // var consumer = new SourceMap.SourceMapConsumer(instrumentedSourceMap);
    // var generator = SourceMap.SourceMapGenerator.fromSourceMap(consumer);
    // generator.applySourceMap(new SourceMap.SourceMapConsumer(file.sourceMap));
    // var finalSourceMap = generator.toString();

    // console.log('the sourcemap', instrumentedSourceMap);
    var base64SourceMap = base64.encode(instrumentedSourceMapString);
    var base64Data = 'data:application/json;base64,' + base64SourceMap;

    // we concat the sourceURL & sourceMappingURL to prevent parse to believe they are the sourceURL
    // & sourcemap of this file
    // eslint-disable-next-line no-useless-concat
    instrumentedSource += '\n//# source' + 'URL=' + sourceURL + '!instrumented';
    // eslint-disable-next-line no-useless-concat
    instrumentedSource += '\n//# source' + 'MappingURL=' + base64Data;

    return instrumentedSource;
}

export default instrument;
