import jsenv from 'jsenv';
import listPreferences from './#{jsenv|default.agent.type}.js';

// languague used by the agent
jsenv.build(function language() {
    var language = {
        preferences: [],
        listPreferences: listPreferences,

        prepare() {
            return Promise.resolve(this.listPreferences()).then(function(preferenceString) {
                this.preferences = preferenceString.toLowerCase().split(',');
                return this.preferences;
            }.bind(this));
        },

        best(proposeds) {
            // get first language matching exactly
            var best = proposeds.find(function(proposed) {
                return this.preferences.findIndex(function(preference) {
                    return preference.startsWith(proposed);
                });
            }, this);

            if (!best) {
                best = proposeds[0];
            }

            return best;
        }
    };

    return {
        language: language
    };
});

// prepare() the language preferences to be able to call jsenv.language.best() sync
    // if (true) { // eslint-disable-line no-constant-condition
    //     installPromise = installPromise.then(function() {
    //         return jsenv.language.prepare();
    //     });
    // }
