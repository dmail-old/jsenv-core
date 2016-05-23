import moduleSourceUrls from './module-source-url.js';

let transpiledSources = new Map();
let translate = System.translate;
System.translate = function(load) {
    return translate.call(this, load).then(function(source) {
        transpiledSources.set(moduleSourceUrls.get(load.name), source);
        return source;
    });
};

export default transpiledSources;
