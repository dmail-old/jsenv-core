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
        name: 'transform-es2015-block-scoping',
        features: [
            'let',
            'let-throw-statement',
            'let-temporal-dead-zone',
            'let-scoped',
            'let-scoped-for-statement',
            'let-scoped-for-body'
        ]
    },
    {
        name: 'transform-es2015-computed-properties',
        features: [
            'computed-properties'
        ]
    },
    {
        name: 'transform-es2015-parameters',
        features: [
            'function-default-parameters',
            'function-default-parameters-explicit-undefined',
            'function-default-parameters-refer-previous',
            'function-default-parameters-arguments',

            'function-rest-parameters',
            'function-rest-parameters-throw-setter',
            'function-rest-parameters-length'
        ]
    },
    {
        name: 'transform-es2015-shorthand-properties',
        features: [
            'shorthand-properties',
            'shorthand-methods'
        ]
    },
    {
        name: 'transform-es2015-spread',
        features: [
            'spread-function-call',
            'spread-function-call-iterable',
            'spread-function-call-iterable-instance',
            'spread-literal-array',
            'spread-literal-array-iterable',
            'spread-literal-array-iterable-instance'
        ]
    },
    {
        name: 'transform-es2015-destructuring',
        features: [
            'destructuring-declaration-array',
            'destructuring-declaration-array-trailing-commas',
            'destructuring-declaration-array-iterable',
            'destructuring-declaration-array-iterable-instance',
            'destructuring-declaration-array-sparse',
            'destructuring-declaration-array-nested',
            'destructuring-declaration-array-for-in-statement',
            'destructuring-declaration-array-for-of-statement',
            'destructuring-declaration-array-catch-statement',
            'destructuring-declaration-array-rest',
            'destructuring-declaration-array-default',

            'destructuring-declaration-object',
            'destructuring-declaration-object-throw-null',
            'destructuring-declaration-object-throw-undefined',
            'destructuring-declaration-object-primitive-return-prototype',
            'destructuring-declaration-object-trailing-commas',
            'destructuring-declaration-object-double-dot-as',
            'destructuring-declaration-object-computed-properties',
            'destructuring-declaration-object-catch-statement',
            'destructuring-declaration-object-default',
            'destructuring-declaration-object-default-let-temporal-dead-zone',

            'destructuring-declaration-array-chain-object',
            'destructuring-declaration-array-nest-object',
            'destructuring-declaration-object-nest-array',

            'destructuring-assignment-array',
            'destructuring-assignment-array-empty',
            'destructuring-assignment-array-rest-nest',
            'destructuring-assignment-array-expression-return',
            'destructuring-assignment-array-chain',

            'destructuring-assignment-object',
            'destructuring-assignment-object-empty',
            'destructuring-assignment-object-expression-return',
            'destructuring-assignment-object-throw-left-parenthesis',
            'destructuring-assignment-object-chain',

            'destructuring-parameters-array',
            'destructuring-parameters-array-function-length',

            'destructuring-parameters-object',
            'destructuring-parameters-object-function-length'
        ]
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
