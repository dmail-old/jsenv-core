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

		throw: function(error){
			throw error;
		},

		exceptions: [],
		exceptionHandlers: [],
		addExceptionHandler: function(exceptionHandler){
			this.exceptionHandlers.push(exceptionHandler);
		},
		/*
		// wait 1000ms before throwing any error
		platform.addExceptionHandler(function(e){
			return new Promise(function(res, rej){ setTimeout(function(){ rej(e); }, 1000); });
		});
		// do not throw error with code itsok
		platform.addExceptionHandler(function(e){
			return e && e instanceof Error && e.code === 'itsok' ? undefined : Promise.reject(e);
		});
		*/
		createException: function(exceptionValue){
			var exception = {
				value: exceptionValue,
				recovered: false,

				createStatusPromise: function(){
					return this.recovered ? Promise.resolve(this.value) : Promise.reject(this.value);
				},

				nextHandler: function(){
					if( this.index < this.handlers.length ){
						var value = this.value;
						var handler = this.handlers[this.index];
						this.index++;

						return new Promise(function(res){
							res(handler(value));
						}).then(
							function(resolutionValue){
								this.recover();
								return this.createStatusPromise();
							}.bind(this),
							function(rejectionValue){
								if( rejectionValue != value ){
									// an error occured during exception handling, log it and consider exception as not recovered
									console.error('the following occurred during exception handling : ', rejectionValue);
									return this.createStatusPromise();
								}
								else{
									return this.nextHandler();
								}
							}.bind(this)
						);
					}
					else{
						return this.createStatusPromise();
					}
				},

				// returns a promise rejected if the exception could not recover using its handlers
				attemptToRecover: function(){
					this.index = 0;
					this.handlers = [].concat(platform.exceptionHandlers);
					return this.nextHandler();
				},

				recover: function(){
					if( false === this.recovered ){
						this.recovered = true;
						platform.exceptions.splice(platform.exceptions.indexOf(this));
					}
				},

				raise: function(){
					platform.exceptions.push(this);

					this.attemptToRecover().catch(function(){
						platform.throw(this.value);
					}.bind(this));
				}
			};

			return exception;
		},

		error: function(error){
			var exception = this.createException(error);
			exception.raise();
			return exception;
		},

		unhandledRejection: function(value, promise){
			var exception = this.createException(value);
			exception.promise = promise;
			exception.raise();
			return exception;
		},

		rejectionHandled: function(promise){
			for(var exception in this.exceptions){
				if( 'promise' in exception && exception.promise == promise ){
					exception.recover();
					break;
				}
			}
		},

		locateFrom: function(location, baseLocation, stripFile){
			var href = new URL(location, baseLocation).href;

			if( stripFile && href.indexOf('file:///') === 0 ){
				href = href.slice('file:///'.length);
			}

			return href;
		},

		locate: function(location, stripFile){
			return this.locateFrom(location, this.baseURL, stripFile);
		},

		locateRelative: function(location, stripFile){
			var trace = platform.trace();

			trace.callSites.shift();

			return this.locateFrom(location, trace.fileName, stripFile);
		},

		locateFromRoot: function(location){
			return this.locateFrom(location, this.location, true);
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

		window.addEventListener('unhandledRejection', function(error, promise){
			platform.unhandledRejection(error, promise);
		});
		window.addEventListener('rejectionHandled', function(promise){
			platform.rejectionHandled(promise);
		});
		window.onerror = function(errorMsg, url, lineNumber, column, error){
			platform.error(error);
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
		platform.restart = function(){
			process.kill(2);
		};

		platform.throw = function(error){
			console.error(error);
			process.exit(1);
		};

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

		process.on('unhandledRejection', function(error, promise){
			platform.unhandledRejection(error, promise);
		});
		process.on('rejectionHandled', function(promise){
			platform.rejectionHandled(promise);
		});
		process.on('uncaughtException', function(error){
			platform.error(error);
		});

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

		platform.global.require = function(moduleId){
			//console.log('use global require on', moduleId);
			return require(moduleId);
		};

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
				var nodeSourceMap = require('system-node-sourcemap');
				nodeSourceMap.install();

				platform.trace = function(error){
					var stack, stackTrace;

					if( arguments.length > 0 ){
						if( false === error instanceof Error ){
							throw new TypeError('platform.trace() first argument must be an error');
						}

						stack = error.stack; // will set error.stackTrace
						stackTrace = error.stackTrace;
					}
					else{
						error = new Error();
						stack = error.stack; // will set error.stackTrace
						stackTrace = error.stackTrace;
						stackTrace.callSites.shift(); // remove this line of the stack trace
					}

					return stackTrace;
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
		}
		else if( platform.type === 'browser' ){
			// noop
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
		});
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