const fs = require('fs');
const zaq = require('zaq');
const path = require('path');
const crypto = require('crypto');

const IMAGE_TYPES = [ 'jpg', 'jpeg', 'png', 'gif', 'ico', 'svg', 'tiff' ];
const TEXT_TYPES = [ 'txt', 'css', 'md', 'scss', 'less', 'sass', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'class', 'java', 'xml', 'json', 'sh', 'yaml' ];

function getFileHash (path) {
  if (!fileExists(path)) {
    zaq.err('Invalid file path provided, can\'t hash:', path);
    return false;
  } else if (dirExists(path)) {
    zaq.err('Invalid file path provided; received dir. Can\'t hash:', path);
    return false;
  }
  const data = fs.readFileSync(path, 'utf-8');
  const hash = crypto.createHash('md5')
    .update(data)
    .digest("hex");
  return hash;
}

function fileExists (path) {
	let exists = false;
	try {
		const stats = fs.statSync(path);
		exists = true;
	} catch (e) {}
	return exists;
}

function dirExists (path) {
	let exists = false;
	try {
		const stats = fs.statSync(path);
		return stats.isDirectory();
	} catch (e) {}
	return exists;
}

function isImageExtension (extension) {
  return IMAGE_TYPES.includes(extension.toLowerCase());
}

function mapDirectory (dir, { ignore = [] } = {}) {
  if (!dirExists(dir)) return null;
  return fs.readdirSync(dir)
    .filter(name => !ignore.includes(name))
    .map(name => {
      const uri = path.resolve(dir, name);
      const stats = fs.statSync(uri);

      const { size } = stats;
      const isDir = stats.isDirectory();
      const relative = path.relative(uri, dir);
      const type = isDir ? 'directory' : 'file';
      const output = { name, uri, type};
      if (!isDir) {
        output.extension = path.extname(name).substring(1);
        output.hash = getFileHash(uri);
      } else {
        output.content = mapDirectory(uri, { ignore });
      }
      return output;
    });
}

function flattenMap (structure = []) {
  let layer = [...structure];
  while (layer.any(isParentStructure)) {
    layer = layer.reduce((itemSet, item) => {
      if (item.type === 'file') return [ ...itemSet, item ];
      if (item.contents && Array.isArray(item.contents)) {
        item.contents = item.contents.map(subItem => )
        return [ ...itemSet, item, ...contents ];
      }
    }, []);
}

function isParentStructure (fileItem = {}) {
  const { type, contents } = fileItem;
  return type === 'directory'
    && Array.isArray(contents)
    && contents.any(subItem => typeof subItem !== 'string');
}

module.exports = { fileExists, dirExists, mapDirectory }
