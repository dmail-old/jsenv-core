/* global System */

(function(){

	var platform = {
		logLevel: 'error',
		readyListeners: [],

		info: function(){
			if( this.logLevel === 'info' ){
				console.info.apply(console, arguments);
			}
		},

		debug: function(){
			if( this.logLevel === 'debug' ){
				console.log.apply(console, arguments);
			}
		},

		ready: function(listener){
			this.readyListeners.push(listener);
		},

		onready: function(){
			return this.readyListeners.reduce(function(previous, listener){
				return previous.then(listener);
			}, Promise.resolve());
		},

		error: function(error){
			this.onerror(error);
		},

		onerror: function(error){
			if( error && error.stackTrace ){
				console.log('transformed error');
				console.error(String(error));
			}
			else if( error instanceof Error ){
				console.log('error object');
				throw error;
			}
			else if( error ){
				console.log('platform error : ' + error);
			}
			else{
				console.log('onerror called without error argument');
			}
		},

		locate: function(location, stripFile){
			var href = new URL(location, this.baseURL).href;

			if( stripFile && href.indexOf('file:///') === 0 ){
				href = href.slice('file:///'.length);
			}

			return href;
		},

		locateFromRoot: function(location){
			var href = new URL(location, this.location).href;

			if( href.indexOf('file:///') === 0 ){
				href = href.slice('file:///'.length);
			}

			return href;
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
		platform.location = document.scripts[document.scripts.length - 1].src;

		platform.systemLocation = 'node_modules/systemjs/dist/system.js';
		platform.polyfillLocation = 'node_modules/babel-polyfill/dist/polyfill.js';
	}
	else if( typeof process != 'undefined' ){
		platform.include = function(url, done){
			var error;

			if( url.indexOf('file:///') === 0 ){
				url = url.slice('file:///'.length);
			}

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
			var base = 'file:///' + process.cwd();

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
		platform.location = 'file:///' + (platform.os == 'windows' ? __filename.replace(/\\/g, '/') : __filename);

		platform.systemLocation = 'node_modules/systemjs/index.js';
		platform.polyfillLocation = 'node_modules/babel-polyfill/lib/index.js';

		if( process.argv.indexOf('-verbose') != -1 ){
			platform.logLevel = 'info';
		}

		var run = function(location){
			var path = require('path');

			location = location.replace(/\\/g, '/');
			location = 'file:///' + location;

			// require platform
			require(path.resolve(__dirname, './index.js'));

			platform.ready(function(){
				platform.info('running', platform.locate(location));
				return System.import(location);
			});
		};

		module.exports = run;
	}
	else{
		throw new Error('unknown platform');
	}

	platform.dirname = platform.location.slice(0, platform.location.lastIndexOf('/'));
	platform.global.platform = platform;
	platform.info(platform.name, String(platform.version), platform.location, platform.baseURL);

	var dependencies = [];

	dependencies.push({
		name: 'URLSearchParams',
		url: 'node_modules/@dmail/url-search-params/index.js',
		condition: function(){
			return false === 'URLSearchParams' in platform.global;
		}
	});

	dependencies.push({
		name: 'URL',
		url: 'node_modules/@dmail/url/index.js',
		condition: function(){
			return false === 'URL' in platform.global;
		}
	});

	dependencies.push({
		name: 'Object.assign',
		url: 'node_modules/@dmail/object-assign/index.js',
		condition: function(){
			return false === 'assign' in Object;
		}
	});

	dependencies.push({
		name: 'Object.complete',
		url: 'node_modules/@dmail/object-complete/index.js',
		condition: function(){
			return false === 'complete' in Object;
		}
	});

	dependencies.push({
		name: 'setImmediate',
		url: 'node_modules/@dmail/set-immediate/index.js',
		condition: function(){
			return false === 'setImmediate' in platform.global;
		}
	});

	dependencies.push({
		name: 'Promise',
		url: 'node_modules/@dmail/promise-es6/index.js',
		condition: function(){
			return true; // force because of node promise not implementing unhandled rejection
			//return false === 'Promise' in platform.global;
		}
	});

	dependencies.push({
		name: 'babel-polyfill',
		url: platform.polyfillLocation
	});

	dependencies.push({
		name: 'System',
		url: platform.systemLocation,
		condition: function(){
			return false === 'System' in platform.global;
		},
		instantiate: function(){
			System.transpiler = 'babel';
			System.babelOptions = {};
			System.paths.babel =  platform.dirname + '/node_modules/babel-core/browser.js';

			if( platform.type === 'process' ){
				require('system-node-sourcemap').install();

				platform.trace = function(error){
					var stackTrace;

					if( error ){
						stackTrace = error.stack;
					}
					else{
						error = new Error();
						stackTrace = error.stack;
						stackTrace.callSites.pop(); // remove this line of the stack trace (not really usefull thanks to getAssertionCaller)
					}

					return stackTrace;
				};

				/*
				var transformError =
				platform.error = function(error){
					transformError(error);
					this.onerror(error);
				};
				*/
				//System.babelOptions.retainLines = true;

				//global.require = require;
				platform.global.require = function(moduleId){
					//console.log('use global require on', moduleId);
					return require(moduleId);
				};
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
				platform.debug('include error', error);
				done(error);
			}
			else if( i === j ){
				platform.debug('all dependencies included');
				done();
			}
			else{
				dependency = dependencies[i];
				i++;

				if( !dependency.condition || dependency.condition() ){
					platform.debug('loading', dependency.name);
					dependency.url = platform.dirname + '/' + dependency.url;
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
					platform.debug('skipping', dependency.name);
					includeNext();
				}
			}
		}

		includeNext();
	}

	function setup(){
		System.set('platform', System.newModule({
			"default": platform
		}));
		System.set('platform-type', System.newModule({
			"default": platform.type
		}));
		System.paths.proto = platform.dirname + '/node_modules/@dmail/proto/index.js';

		if( platform.type === 'process' ){
			var nativeModules = [
				'assert',
				'http',
				'https',
				'fs',
				'stream',
				'path',
				'url',
				'querystring',
				'child_process',
				'util'
			];

			nativeModules.forEach(function(name){
				System.set('node/' + name, System.newModule({
					"default": require(name)
				}));
			});

			process.on('unhandledRejection', function(error, p){
				if( error ){
					console.log('unhandledRejection catched');
					platform.error(error);
				}
			});
		}

		System.import(platform.dirname + '/namespace.js').then(function(exports){
			var NameSpaceConfig = exports['default'];
			var nameSpaceConfig = NameSpaceConfig.create();

			nameSpaceConfig.add({
				namespace: 'dmail',
				path: 'file:///C:/Users/Damien/Documents/Github'
			});

			var normalize = System.normalize;
			System.normalize = function(moduleName, parentModuleName, parentModuleUrl){
				moduleName = nameSpaceConfig.locate(moduleName);
				return normalize.apply(this, arguments);
			};

			platform.onready();
		}, platform.onerror);
	}

	includeDependencies(dependencies, function(error){
		if( error ){
			platform.debug('error ocurred');

			throw error;
		}
		else{
			platform.debug('call setup');

			setup();
		}
	});

})();