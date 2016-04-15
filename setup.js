function provideCorefeatures(features) {
    features.provide(function locate() {
        return {
            internalURI: new global.URI(this.internalURL),
            baseURI: new global.URI(this.baseURL),

            locateFrom: function(data, baseURI, stripFile) {
                var href = new global.URI(this.cleanPath(data), this.cleanPath(baseURI)).href;

                if (stripFile && href.indexOf('file:///') === 0) {
                    href = href.slice('file:///'.length);
                }

                return href;
            },

            locate: function(data, stripFile) {
                return this.locateFrom(data, this.baseURI, stripFile);
            },

            locateInternal: function(data, stripFile) {
                return this.locateFrom(data, this.internalURI, stripFile);
            }
        };
    });

    // setImmediate, Promise, URL, System, URI, locate are now available
    // we must also provide es6 polyfills (Map, Set, Iterator, ...)
    // so here we only provide task & plugin API to be able to do features.config(), features.run(), features.importMain()
    // and we add some default plugin like es6, Location, agent-config etc that user can later disable or add plugin before of after

    features.provide(function task() {
        var Task = function() {
            if (arguments.length === 1) {
                this.populate(arguments[0]);
            } else if (arguments.length === 2) {
                this.name = arguments[0];
                this.populate(arguments[1]);
            }
        };

        Task.prototype = {
            dependencies: [], // should check that taks dependencies have been executed before executing this one
            name: undefined,
            skipped: false,
            disabled: false,
            ended: false,
            next: null,

            populate: function(properties) {
                if (typeof properties === 'object') {
                    for (var key in properties) { // eslint-disable-line
                        this[key] = properties[key];
                    }
                } else if (typeof properties === 'function') {
                    this.fn = properties;
                    if (this.hasOwnProperty('name') === false) {
                        this.name = this.fn.name;
                    }
                }
            },

            skipIf: function(getSkipReason) {
                this.getSkipReason = getSkipReason;
                return this;
            },

            enable: function() {
                this.disabled = false;
            },

            disable: function() {
                this.disabled = true;
            },

            chain: function(task) {
                if (this.ended) {
                    throw new Error(this.name + 'task is ended : cannot chain more task to it');
                }

                // features.debug('do', task.name, 'after', this.name);

                var next = this.next;
                if (next) {
                    next.chain(task);
                } else {
                    this.next = task;
                }

                return this;
            },

            insert: function(task, beforeTask) {
                if (beforeTask) {
                    var next = this.next;
                    if (!next) {
                        throw new Error('cannot insert ' + task.name + ' before ' + beforeTask.name);
                    }

                    if (next === beforeTask) {
                        this.next = null;

                        this.chain(task);
                        task.chain(next);
                        return this;
                    }
                    return next.insert(task, beforeTask);
                }

                return this.chain(task);
            },

            skip: function(reason) {
                this.skipped = true;
                reason = reason || 'no specific reason';
                features.debug('skip task', this.name, ':', reason);
            },

            locate: function() {
                var location;
                if (this.url) {
                    location = features.locate(this.url);
                } else {
                    location = features.locate(this.name);
                }
                return location;
            },

            locateHook: function() {
                return Promise.resolve(this.locate()).then(function(location) {
                    this.location = location;
                    return location;
                }.bind(this));
            },

            import: function() {
                return this.locateHook().then(function(location) {
                    features.debug('importing', location);
                    return features.import(location);
                });
            },

            exec: function(value) {
                if (this.hasOwnProperty('fn') === false) {
                    return this.import();
                }
                return this.fn(value);
            },

            before: function(value) {
                return value;
            },

            after: function(value) {
                return value;
            },

            start: function(value) {
                // features.info(features.type, features.location, features.baseURL);
                features.task = this;
                features.debug('start task', this.name);

                return Promise.resolve(value).then(
                    this.before.bind(this)
                ).then(function(resolutionValue) {
                    if (this.disabled) {
                        this.skip('disabled');
                    } else if (this.hasOwnProperty('getSkipReason')) {
                        var skipReason = this.getSkipReason();
                        if (skipReason) {
                            this.skip(skipReason);
                        }
                    }

                    if (this.skipped) {
                        return resolutionValue;
                    }
                    return this.exec(resolutionValue);
                }.bind(this)).then(function(resolutionValue) {
                    this.ended = true;
                    return this.after(resolutionValue);
                }.bind(this)).then(function(resolutionValue) {
                    if (this.next) {
                        // will throw but it will be ignored
                        return this.next.start(value);
                    }
                    return resolutionValue;
                }.bind(this));
            }
        };

        var noop = function() {};
        var headTask = new Task('head', noop);
        var tailTask = new Task('tail', noop);

        headTask.chain(tailTask);

        var taskChain = {
            head: headTask,
            tail: tailTask,

            get: function(taskName) {
                var task = this.head;

                while (task) {
                    if (task.name === taskName) {
                        break;
                    } else {
                        task = task.next;
                    }
                }

                return task;
            },

            enable: function(taskName) {
                return this.get(taskName).enable();
            },

            disable: function(taskName) {
                return this.get(taskName).disabled();
            },

            add: function(task) {
                return this.head.chain(task);
            },

            insert: function(task, beforeTask) {
                return this.head.insert(task, beforeTask);
            },

            create: function(firstArg, secondArg) {
                return new Task(firstArg, secondArg);
            }
        };

        return {
            taskChain: taskChain
        };
    });

    features.provide(function mainTask() {
        var mainTask = this.taskChain.create('main', function() {
            var mainModulePromise;

            if (features.mainSource) {
                features.debug('get mainModule from source string');
                mainModulePromise = System.module(features.mainSource, {
                    address: features.mainLocation
                });
            } else if (features.mainModule) {
                features.debug('get mainModule from source object');
                features.mainModule = System.newModule(features.mainModule);
                System.set(features.mainLocation, features.mainModule);
                mainModulePromise = Promise.resolve(features.mainModule);
            } else {
                features.debug('get mainModule from source file', features.mainLocation);
                mainModulePromise = System.import(features.mainLocation);
            }

            return mainModulePromise.then(function(mainModule) {
                features.debug('mainModule imported', mainModule);
                features.mainModule = mainModule;
                return mainModule;
            });
        });

        this.taskChain.insert(mainTask, this.taskChain.tail);

        return {
            mainTask: mainTask,

            config: function() {
                var task = this.taskChain.create.apply(null, arguments);
                return this.taskChain.insert(task, mainTask);
            },

            run: function() {
                var task = this.taskChain.create.apply(null, arguments);
                return this.taskChain.add(task);
            },

            evalMain: function(source, sourceURL) {
                this.mainSource = source;
                this.mainLocation = sourceURL || './anonymous';
                return this.start();
            },

            exportMain: function(moduleExports) {
                // seems strange to pass an object because this object will not benefit
                // from any polyfill/transpilation etc
                this.mainModule = moduleExports;
                this.mainLocation = './anonymous';
                return this.start();
            },

            importMain: function(moduleLocation) {
                this.mainLocation = moduleLocation;
                return this.start();
            },

            start: function() {
                if (!this.mainLocation) {
                    throw new Error('mainLocation must be set before calling features.start()');
                }

                this.mainLocation = features.locate(this.mainLocation);

                return this.taskChain.head.start().then(function() {
                    return features.mainModule;
                });
            }
        };
    });

    features.provide(function plugin() {
        return {
            plugin: function(name, properties) {
                var task = features.config(name);
                task.locate = function() {
                    return features.dirname + '/plugins/' + this.name + '/index.js';
                };
                task.populate(properties);
                return task;
            }
        };
    });

    /*
    plugin('es6', {
        locate: function() {
            var polyfillLocation;

            if (features.isBrowser()) {
                polyfillLocation = 'node_modules/babel-polyfill/dist/polyfill.js';
            } else {
                polyfillLocation = 'node_modules/babel-polyfill/lib/index.js';
            }

            return features.dirname + '/' + polyfillLocation;
        }
    });

    // we wait for promise, & system before adding exceptionHandler
    plugin('exception-handler');

    plugin('module-internal');

    plugin('module-source');

    plugin('module-script-name');

    plugin('module-source-transpiled');

    plugin('module-sourcemap');

    plugin('agent-config', {
        locate: function() {
            return features.dirname + '/plugins/agent-' + features.agent.type + '/index.js';
        }
    });

    plugin('module-test');
    */

    return features;
}

export default provideCorefeatures;
