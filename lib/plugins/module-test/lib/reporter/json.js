import nodefs from '@node/fs';

/*
var sourceMap = require('system-node-sourcemap');

// it does the trick too
Error.prototype.toJSON = function() { // eslint-disable-line no-extend-native
    return sourceMap(this);
};
*/

var TestJSONReporter = {
    constructor: function(path) {
        this.stream = nodefs.createWriteStream(path);
        // this.json = {};
    },

    events: {
        end: function(test) {
            var json = test.toJSON();

            json.agent = global.engine.agent;

            this.stream.write(JSON.stringify(json, null, '\t'));
        }
    }
};

export default TestJSONReporter;

/*
if( this.options.report && (this.state != 'skipped' || this.reason != 'NOT_MODIFIED') ){
            fs('mkdir', nodepath.dirname(this.reportPath)).catch(function(e){
                if( e && e.code === 'EEXIST' ){
                    return undefined;
                }
                return Promise.reject(e);
            }).then(function(){
                // now we can write the report file
                var sourceMap = require('system-node-sourcemap');

                Error.prototype.toJSON = function(){
                    return sourceMap(this);
                };

                var json = this.toJSON();
                json.platform = {
                    type: platform.type,
                    name: platform.name,
                    version: platform.version
                };

                // pour pouvoir écrire ici il faut dabord créer le dossier, s'il existe il faut le supprimer

                var stream = nodefs.createWriteStream(this.reportPath);
                stream.write(JSON.stringify(json, null, '\t'));

            }.bind(this));
}
*/
