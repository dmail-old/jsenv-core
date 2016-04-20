let moduleSources = new Map();

let translate = System.translate;
System.translate = function(load) {
    let moduleSource = load.source;
    moduleSources.set(load.name, moduleSource);
    return translate.call(this, load);
};

export default moduleSources;
