const CONFIG_FILENAME = '.flyboyrc';
const MAP_EXTENSION = '.fmap.json';
const MIGRATE_SCRIPT_NAME = 'flyboy-migrate.sh';
const IMAGE_TYPES = [ 'jpg', 'jpeg', 'png', 'gif', 'ico', 'svg', 'tiff' ];
const STYLE_TYPES = [ 'scss', 'less', 'css' ];
const TEXT_TYPES = [ 'txt', 'css', 'md', 'scss', 'less', 'sass', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'class', 'java', 'xml', 'json', 'sh', 'yaml', 'tag', 'jsp', 'gitignore' ];
const RESOLVE_EXTENSIONS = [ '.js', '.jsx', '.ts', '.tsx', '.scss', '.css' ];
const IMPORT_PATH_PATTERN = /import (?:{? ?(?:\*|[a-zA-Z0-9_]+)(?:\sas\s[a-zA-Z0-9]+)?,? ?}?,?)*(?:'|")([a-zA-Z0-9./\-_]*)(?:'|");?/g;
const SIMILARITY_THRESHOLD = 0.95;

module.exports = {
  TEXT_TYPES,
  IMAGE_TYPES,
  STYLE_TYPES,
  MAP_EXTENSION,
  CONFIG_FILENAME,
  RESOLVE_EXTENSIONS,
  MIGRATE_SCRIPT_NAME,
  IMPORT_PATH_PATTERN,
  SIMILARITY_THRESHOLD
};
