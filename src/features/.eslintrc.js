module.exports = {
    "extends": "../../.eslintrc.js",
    "globals": {
        // available thanks to auto generation of the following snippet
        // 'var filename = '';\nexport {filename}\n'
        // which is inserted at the top of every feature.js file
        "filename": true
    },
    "rules": {
        "no-unused-expressions": [
            "off"
        ],
        "no-extend-native": [
            "off"
        ]
    }
};
