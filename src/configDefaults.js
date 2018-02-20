module.exports = {
  ignore: [ 'node_modules', '.git', '.svn', '.DS_Store' ],
  ignoreWhen: (name) => {
    return name.indexOf('.fmap.json') !== -1;
  }
};
