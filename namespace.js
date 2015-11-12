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

/*
Specifications :

system-platform cherche à loader modules/config.js (404 est catch, c'est ok)
lorsque config.js est load je m'en sers pour modifier l'endroit où sont supposé être mes modules

Il faut maintenant créer un utilitaire qui va juste créer des liens symboliques pour tous les modules
en faisant en sorte que /modules pointe vers un folder unique définit dans une conf

Fonctionnement de base
import 'github/username/reponame/<optional-filename.js>';
(1) check dabord si présent sur le filesystem
(2) sinon récup depuis github
(3) écris sur le filesystem
(4) retourne le fichier ainsi créé
(*) <optional-filename.js> : si non spécifié met la config.main ou 'index.js'

Je suis travis :
import 'github/dmail/polymorph';
Le fichier n'existe pas dans modules/ donc je le récup de github , je le stock et tout se passe bien

Je suis node :
import 'github/dmail/polymorph';
Même comportement sauf que la plupart du temps modules/ est symplink et j'ai de grande chance d'y trouve dmail/polymorph

Un souci : il faut créer le dossier modules pour chaque module
Est-ce que System me permet de savoir où je suis pour requêter le bon folder appelé modules
-> non puisqu'en fait si je commence à lancer system-platform
dans un sous-dossier du module
bah je vais chercher ./modules/ mais ça n'existe pas
donc le concept tombe à l'eau je pense

je sais juste pas où foutre ce putain de fichier de config qui est spécifique à github/dmail finalement
mais aussi spécifique à celui qui en a besoin
on peut très bien imaginer que j'ai besoin de github/dmail
sur mon pc dans deux projets différents

reste encore à réfléchir
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
