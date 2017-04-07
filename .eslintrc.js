module.exports = {
	"extends": "./eslint.js",
	"env": {
		"browser": true
	},
	"globals": {
		"jsenv": true
	},
	"plugins": ["import"],
	"settings": {
		'import/extensions': ['.js', '.jsx'],
	},
	"rules": {
		"indent": [
			"warn",
			"tab",
			// I don't want to force people identation width to be 2 or 4
			// they decide how much space a tab char takes (2, 4, 100) in their environment
			// if you prefer indent using space
			// https://alexzaytsev.me/2014/10/19/git-filter-to-convert-spaces-to-tabs-and-vice-versa/
			// basically you go to paste the following into .gitconfig
			// [filter "spaces2tabs"]
    	//   clean = unexpand --tabs=4 --first-only
    	//   smudge = expand --tabs=4 --initial
			{
				"SwitchCase": 1
			}
		],
		"quotes": [
			"warn",
			"double" // because JSON requires it so facilitates it
		],
		"prefer-template": [
			"warn"
		],
		"import/default": [
			"error"
		],
		"import/no-unresolved": [
			"error",
			{
				commonjs: true,
				amd: false
			}
		],
		"import/named": [
			"error"
		],
		"import/namespace": [
			"error",
			{
				"allowComputed": true
			}
		],
		"import/no-absolute-path": [
			"error"
		],
		"import/no-dynamic-require": [
			"error"
		],
		"import/export": [
			"error"
		],
		"import/no-named-as-default": [
			"warn"
		],
		"import/first": [
			"warn"
		],
		"import/no-duplicates": [
			"warn"
		],
		"import/newline-after-import": [
			"warn"
		],
		"import/max-dependencies": [
			"warn",
			{
				"max": 10
			}
		],
		// "import/no-anonymous-default-export": [
		//     "error",
		//     {
		//         "allowArray": true,
		//         "allowArrowFunction": false,
		//         "allowAnonymousClass": false,
		//         "allowAnonymousFunction": false,
		//         "allowLiteral": true,
		//         "allowObject": true
		//     }
		// ],
		/*
		because it seems like a good idea at first (to force specific quote style) but then
		you fall into edge case where you want to keep quote or not for good reasons
		and you dont want a too restrictive rule to get in your way
		*/
		"quote-props": [
			"error",
			"as-needed",
			{
				"keywords": false,
				"numbers": true,
				"unnecessary": false
			}
		],
		"no-warning-comments": [
			"off"
		],
		/*
		Variable hoisting is bad, I agree
		Function hoisting is mega cool because it lets your structure you code so that surface methods
		are at the top and implementation detail at the bottom.

		Sometimes your variable contains a function, in that case this variable is used
		as a function and becomes a sort of function hoisting but eslint can't
		This can happen when you bind, curry, memoize your functions.
		It happen very often and I don't want to write // eslint-disable-line no-use-before-define
		All the time.
		However I'll not use variable hoisting anywhere, I hate that anyway.

		Considering all of this, I'm disabling "no-use-before-define".
		*/
		"no-use-before-define": [
			"off"
		],
		"no-eval": [
			"off"
		],
		"semi": [
			"error",
			"never"
		],
		"brace-style": [
			"error",
			"stroustrup"
		],
		"arrow-parens": [
			"error",
			"always"
			// {
			//     "requireForBlockBody": true
			// }
		],
		"comma-dangle": [
			"error",
			"only-multiline"
		]
	}
};
