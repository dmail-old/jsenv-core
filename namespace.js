/*

import * from 'dmail/module';

'dmail/module' -> où est tu?

normalize
moduleName = 'dmail/module'
parentName = quelque chose mais on s'en fous

dans 'dmail/module' qui en fait sera dans 'file:///C:/Users/Damien/Github/module/index.js', où est 'lib/index.js'

normalize
moduleName = 'lib/index.js'
parentName = 'file:///C:/Users/Damien/Github/module/index.js'

la condition c'est donc :
Si moduleName est namespaced -> ignore le parentName
Sinon regarde si parentName est le résultat d'un namespace, si oui, ça change rien lol
*/

import proto from 'proto';

var NameSpaceConfig = proto.extend.call(Set, {
	constructor(){
		this.configs = [];
	},

	add(config){
		this.configs.push(config);
	},

	[Symbol.iterator](){
		return this.configs[Symbol.iterator]();
	},

	getNameSpace(moduleName){
		var namespace;
		var firstChar = moduleName[0];

		if( firstChar != '/' && firstChar != '.' ){
			var firstSlashIndex = moduleName.indexOf('/');
			if( firstSlashIndex > -1 ){
				namespace = moduleName.slice(0, firstSlashIndex);
			}
		}

		return namespace;
	},

	find(moduleName){
		var namespace = this.getNameSpace(moduleName), config;

		if( namespace ){
			for(config of this){
				if( config.namespace === namespace ) break;
				else config = undefined;
			}
		}

		return config;
	},

	locate(moduleName){
		var config = this.find(moduleName);
		var nameLocation;

		if( config ){
			nameLocation = config.path + moduleName.slice(config.namespace.length);

			// si ne termine pas par une extension ajoute index.js
			if( false === nameLocation.endsWith('.js') ){
				// faudrais plutot add config.main
				nameLocation+= '/index.js';
			}
		}
		else{
			nameLocation = moduleName;
		}

		return nameLocation;
	}
});

export default NameSpaceConfig;
