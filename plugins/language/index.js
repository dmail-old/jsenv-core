import listPreferences from './#{jsenv|agent.type}.js';

export function install(jsenv) {
    //  languague used by the agent
    jsenv.config(function language() {
        var language = {
            preferences: [],
            listPreferences: listPreferences,

            bestLanguage: function(proposeds) {
                return Promise.resolve(this.listPreferences()).then(function(preferenceString) {
                    var preferences = preferenceString.toLowerCase().split(',');
                    var best;

                    // get first language matching exactly
                    best = proposeds.find(function(proposed) {
                        return preferences.findIndex(function(preference) {
                            return preference.startsWith(proposed);
                        });
                    });

                    if (!best) {
                        best = proposeds[0];
                    }

                    return best;
                });
            }
        };

        return {
            language: language
        };
    });
}
