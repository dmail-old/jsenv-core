import moduleScriptNames from '../module-script-name/index.js';

let transpiledSources = new Map();
let translate = System.translate;
System.translate = function(load) {
    return translate.call(this, load).then(function(source) {
        transpiledSources.set(moduleScriptNames.get(load.name), source);
        return source;
    });
};

export default transpiledSources;
