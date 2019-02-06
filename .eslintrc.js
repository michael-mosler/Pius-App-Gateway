module.exports = {
    "extends": "standard",
    "plugins": ["mocha"],
    "env": {
      "mocha": true
    },
    "rules": {
      "comma-dangle": ["error", "always-multiline"],
      "semi": [2, "always"],
      "space-before-function-paren": [2, {"anonymous": "always", "named": "never", "asyncArrow": "always"}]
    }
};