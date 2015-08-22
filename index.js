/* global System */

(function(){

	var platform = {
		logLevel: 'info',

		readyListeners: [],

		info: function(){
			if( this.logLevel === 'info' ){
				console.info.apply(console, arguments);
			}
		},

		ready: function(listener){
			this.readyListeners.push(listener);
		},

		onready: function(){
			return this.readyListeners.reduce(function(previous, listener){
				return previous.then(function(){
					return Promise.resolve(listener());
				});
			}, Promise.resolve());
		},

		error: function(error){
			this.onerror(error);
		},

		onerror: function(error){
			if( error.stackTrace ){
				console.error(String(error));
			}
			else{
				throw error;
			}
		}
	};

	var baseURL;

	function parseVersion(version){
		var parts = String(version).split('.');

		return {
			major: parseInt(parts[0]),
			minor: parts[1] ? parseInt(parts[1]) : 0,
			patch: parts[2] ? parseInt(parts[2]) : 0,
			toString: function(){
				return this.major + '.' + this.minor + '.' + this.patch;
			}
		};
	}

	if( typeof window !== 'undefined' ){
		platform.restart = function(){
			window.reload();
		};

		platform.include = function(url, done){
			var script = document.createElement('script');

			script.src = url;
			script.type = 'text/javascript';
			script.onload = function(){
				done();
			};
			script.onerror = function(error){
				done(error);
			};

			document.head.appendChild(script);
		};

		var agent = (function(){
			var ua = navigator.userAgent.toLowerCase();
			var regex = /(opera|ie|firefox|chrome|version)[\s\/:]([\w\d\.]+(?:\.\d+)?)?.*?(safari|version[\s\/:]([\w\d\.]+)|$)/;
			var UA = ua.match(regex) || [null, 'unknown', 0];
			var name = UA[1] == 'version' ? UA[3] : UA[1];
			var version;

			// version
			if( UA[1] == 'ie' && document.documentMode ) version = document.documentMode;
			else if( UA[1] == 'opera' && UA[4] ) version = UA[4];
			else version = UA[2];

			return {
				name: name,
				version: version
			};
		})();

		baseURL = (function(){
			var href = window.location.href.split('#')[0].split('?')[0];
			var base = href.slice(0, href.lastIndexOf('/') + 1);

			return base;
		})();

		platform.type = 'browser';
		platform.global = window;
		platform.baseURL = baseURL;
		platform.name = agent.name;
		platform.version = parseVersion(agent.version);
		platform.os = navigator.platform.toLowerCase();
		platform.dirname = './'; // il faut remonter la balise script poursavoir où on se trouve je crois

		platform.systemLocation = platform.dirname + 'node_modules/systemjs/system.js';
	}
	else{
		platform.include = function(url, done){
			var error;

			try{
				require(url);
			}
			catch(e){
				error = e;
			}

			done(error);
		};

		platform.restart = function(){
			process.kill(2);
		};

		baseURL = (function(){
			var base = 'file://' + process.cwd();

			if( process.platform.match(/^win/) ){
				base = base.replace(/\\/g, '/');
			}
			if( base[base.length - 1] != '/' ){
				base+= '/';
			}

			return base;
		})();

		platform.type = 'process';
		platform.global = global;
		platform.baseURL = baseURL;
		platform.name = parseInt(process.version.match(/^v(\d+)\./)[1]) >= 1 ? 'iojs' : 'node';
		platform.version = parseVersion(process.version.slice(1));
		// https://nodejs.org/api/process.html#process_process_platform
		// 'darwin', 'freebsd', 'linux', 'sunos', 'win32'
		platform.os = process.platform === 'win32' ? 'windows' : process.platform;
		platform.dirname = (platform.os == 'windows' ? __dirname.replace(/\\/g, '/') : __dirname) + '/';

		platform.systemLocation = platform.dirname + 'lib/system.js';

		if( process.argv.indexOf('--silent') != -1 ){
			platform.logLevel = 'error';
		}
	}

	platform.info(platform.name, platform.version);
	platform.global.platform = platform;

	var dependencies = [];

	dependencies.push({
		name: 'URLSearchParams',
		url: platform.dirname + 'node_modules/@dmail/url-search-params/index.js',
		condition: function(){
			return false === 'URLSearchParams' in platform.global;
		}
	});

	/*
	dependencies.push({
		name: 'URL',
		url: platform.dirname + 'node_modules/@dmail/url/index.js',
		condition: function(){
			return false === 'URL' in platform.global;
		}
	});
	*/

	dependencies.push({
		name: 'Object.assign',
		url: platform.dirname + 'node_modules/@dmail/object-assign/index.js',
		condition: function(){
			return false === 'assign' in Object;
		}
	});

	dependencies.push({
		name: 'setImmediate',
		url: platform.dirname + 'node_modules/@dmail/set-immediate/index.js',
		condition: function(){
			return false === 'setImmediate' in platform.global;
		}
	});

	dependencies.push({
		name: 'Promise',
		url: platform.dirname + 'node_modules/@dmail/promise-es6/index.js',
		condition: function(){
			return true; // force because of node promise not implementing unhandled rejection
			//return false === 'Promise' in platform.global;
		}
	});

	dependencies.push({
		name: 'System',
		url: platform.systemLocation,
		condition: function(){
			return false === 'System' in platform.global;
		},
		instantiate: function(){
			System.transpiler = 'babel';
			//System.paths.babel = 'file:///' + platform.dirname + 'node_modules/babel-core/browser.js';
			System.babelOptions = {

			};

			if( platform.type === 'process' ){
				System.paths.babel = 'file:///' + platform.dirname + 'node_modules/babel-core/browser.js';

				var transformError = require('system-node-sourcemap');
				require('babel/polyfill');
				platform.error = function(error){
					transformError(error);
					this.onerror(error);
				};
				//System.babelOptions.retainLines = true;

				platform.global.require = function(module){
					return require(module);
				};
			}
			else{
				System.paths.babel = platform.dirname + 'node_modules/babel-core/browser.js';
			}
		}
	});

	function includeDependencies(dependencies, callback){
		var i = 0, j = dependencies.length, dependency;

		function done(error){
			setImmediate(function(){
				callback(error);
			});
		}

		function includeNext(error){
			if( error ){
				platform.info('include error', error);
				done(error);
			}
			else if( i === j ){
				platform.info('all dependencies included', error);
				done();
			}
			else{
				dependency = dependencies[i];
				i++;

				if( !dependency.condition || dependency.condition() ){
					platform.info('loading', dependency.name);
					platform.include(dependency.url, function(error){
						if( error ){
							includeNext(error);
						}
						else{
							if( dependency.instantiate ){
								dependency.instantiate();
							}
							includeNext();
						}
					});
				}
				else{
					platform.info('skipping', dependency.name);
					includeNext();
				}
			}
		}

		includeNext();
	}

	includeDependencies(dependencies, function(error){
		if( error ) throw error;

		var conditionals = {
			'platform': platform.type
		};

		var normalize = System.normalize;
		System.normalize = function(name){
			for(var key in conditionals ){
				var conditional = '{' + key +  '}';

				if( name.indexOf(conditional) != -1 ){
					name = name.replace(conditional, conditionals[key]);
				}
			}
			return normalize.apply(this, arguments);
		};

		if( platform.type === 'process' ){
			var nativeModules = ['http', 'https', 'fs', 'stream', 'path', 'url', 'querystring', 'child_process'];
			nativeModules = nativeModules.map(function(name){
				return 'node/' + name;
			});

			var fetch = System.fetch;
			System.fetch = function(load){
				var name = load.address.slice(System.baseURL.length);

				if( nativeModules.indexOf(name) != -1 ){
					return 'module.exports = require("' + name + '")';
				}
				return fetch.call(this, load);
			};

			process.on('unhandledRejection', function(error, p){
				if( error ){
					platform.error(error);
				}
			});
		}

		platform.onready();
	});

})();