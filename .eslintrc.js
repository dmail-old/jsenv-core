module.exports = {
    "extends": "./eslint.js",
    "rules": {
        /*
        because it seems like a good idea at first (to force specific quote style) but then
        you fall into edge case where you want to keep quote or not for good reasons
        and you dont want a too restrictive rule to get in your way
        */
        "quote-props": [
            "error",
            "as-needed",
            {
                "keywords": true,
                "numbers": true,
                "unnecessary": false
            }
        ],
        "no-warning-comments": [
            "off"
        ]
    }
};
