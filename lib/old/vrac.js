 /*
        DEPRECATED (not used anymore)
        provide(function include() {
            var importMethod;

            if (features.isBrowser()) {
                importMethod = function(url) {
                    var script = document.createElement('script');
                    var promise = new Promise(function(resolve, reject) {
                        script.onload = resolve;
                        script.onerror = reject;
                    });

                    script.src = url;
                    script.type = 'text/javascript';
                    document.head.appendChild(script);

                    return promise;
                };
            } else {
                importMethod = function(url) {
                    if (url.indexOf('file:///') === 0) {
                        url = url.slice('file:///'.length);
                    }

                    return new Promise(function(resolve) {
                        resolve(require(url));
                    });
                };
            }

            return {
                import: importMethod
            };
        });
        */
