const { CONFIG_FILENAME, MAP_EXTENSION } = require('./constants');

module.exports = {
  ignore: [ 'node_modules', '.git', '.svn', '.DS_Store' ],
  ignoreWhen: (name) => {
    return name.indexOf(MAP_EXTENSION) !== -1 && name !== CONFIG_FILENAME;
  }
};
