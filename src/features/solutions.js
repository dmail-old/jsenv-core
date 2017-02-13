var rootFolder = require('path').resolve(__dirname, '../..').replace(/\\/g, '/');
var jsenv = global.jsenv;
var Iterable = jsenv.Iterable;

var createSolution = (function() {
    function Solution(name, descriptor) {
        this.name = name;
        jsenv.assign(this, descriptor);

        // TODO : si une solution utilise déjà name il faut throw

        // il serais pratique d'avoir un peu comme pour feature ici
        // c'est à dire de pouvoir exprimer une liste de dépendances
        // de sorte que isRequired() retourne true si un dépendent retourne isRequired()
        // pratique pour le cas transform-generator
        // c'est du boulot et pas indipensable donc reporté à plus tard
        // this.dependencies = [];
        // this.dependents = [];
    }

    Solution.prototype = {
        constructor: Solution,
        required: 'auto',
        features: [],
        config: {},

        getConfig: function() {
            return this.config;
        },

        isRequired: function(implementation) {
            var required;
            var requiredValue = this.required;

            if (requiredValue === 'auto') {
                var someFeatureIsProblematic = Iterable.some(this.features, function(featureName) {
                    return implementation.get(featureName).isProblematic();
                });
                required = someFeatureIsProblematic;
            } else if (typeof requiredValue === 'boolean') {
                required = requiredValue;
            } else {
                throw new TypeError('solution.required must be a boolean or "auto"');
            }

            return required;
        }
    };

    return function() {
        return jsenv.construct(Solution, arguments);
    };
})();
function locate(path) {
    if (path[0] === '.' && path[1] === '/') {
        path = rootFolder + path.slice(1);
    }
    return path;
}

var coreJSSolutions = [];
var fileSolutions = [
    {
        name: 'regenerator',
        path: locate('./node_modules/regenerator/dist/regenerator.js'),
        required: 'auto',
        isRequired: function() {
            return false;
            // var features = [
            //     'function-generator',
            //     'function-async',
            //     'function-generator-async'
            // ];
            // return Iterable.some(features, function(featureName) {
            //     return implementation.get(featureName).isProblematic();
            // });
        }
    }
];
var babelSolutions = [
    {
        name: 'transform-regenerator',
        required: false, // on désactive pour le moment, j'ai pas fait les feature correspondantes
        features: [
            'function-generator'
        ],
        config: {
            generators: 'auto',
            async: 'auto',
            asyncGenerators: 'auto'
        },
        getConfig: function(implementation) {
            var config = {};
            jsenv.assign(config, this.config);

            if (config.generators === 'auto') {
                config.generators = implementation.get('function-generator').isProblematic();
            }
            if (config.async === 'auto') {
                config.async = implementation.get('function-async').isProblematic();
            }
            if (config.asyncGenerators === 'auto') {
                config.asyncGenerators = implementation.get('function-generator-async').isProblematic();
            }

            return config;
        }
    },
    {
        name: 'check-es2015-constants',
        required: true
    }
];

var solutions = [];
Iterable.forEach(coreJSSolutions, function(coreJSSolution) {
    var solution = createSolution(coreJSSolution.name, coreJSSolution);
    solution.type = 'polyfill';
    solution.author = 'corejs';

    solutions.push(solution);
    return solution;
});
Iterable.forEach(fileSolutions, function(fileSolution) {
    var solution = createSolution(fileSolution.name, fileSolution);
    solution.type = 'polyfill';
    solution.author = 'me';

    solutions.push(solution);
    return solution;
});
Iterable.forEach(babelSolutions, function(babelSolution) {
    var solution = createSolution(babelSolution.name, babelSolution);
    solution.type = 'transpile';
    solution.author = 'babel';

    solutions.push(solution);
    return solution;
});

module.exports = solutions;
