/*
    var i18nPlugin = {
        fetch: function(load, fetch) {
            console.log('fetching', load);
            return fetch(load);
        },

        instantiate: function(load, instantiate) {
            console.log('instantiating', load.name);
            global.module = load.address;
            return instantiate(load).then(function(result) {
                console.log('instantiated to', result);
                return result;
            });
        }
    };

    System.set('plugin-i18n', System.newModule(i18nPlugin));

    System.config({
        meta: {
            '*': {
                loader: 'plugin-i18n'
            }
        }
    });
    */
