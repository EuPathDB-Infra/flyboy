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

function mapDirectory (dir, { ignore = [], rootDir = '/' } = {}) {
  if (!dirExists(dir)) return null;
  return fs.readdirSync(dir)
    .filter(name => !ignore.includes(name))
    .map(name => {
      const fullUri = path.join(dir, name);
      const uri = path.relative(rootDir, fullUri);
      const stats = fs.statSync(fullUri);
      const { size } = stats;
      const isDir = stats.isDirectory();
      const type = isDir ? 'directory' : 'file';
      const output = { name, uri, type};
      if (isDir) {
        output.content = mapDirectory(fullUri, { ignore, rootDir });
      } else {
        output.extension = path.extname(name).substring(1);
        output.hash = getFileHash(fullUri);
        output.filename = path.parse(name).name;
      }
      return output;
    });
}

function flattenMap (structure = []) {
  let layer = [...structure];
  while (layer.some(isParentStructure)) {
    layer = layer.reduce((itemSet, item) => {
      if (item.type !== 'directory') {
        return [ ...itemSet, item ];
      } else {
        const { content } = item;
        if (Array.isArray(content) && content.every(item => typeof item === 'object')) {
          const additionals = flattenMap(content);
          item.content = content
            .filter(({ hash }) => hash)
            .map(({ hash }) => hash);
          return [ ...itemSet, item, ...additionals ];
        } else {
          return [ ...itemSet ];
        }
      }
    }, []);
  };
  return layer;
}

function isValidList (list) {
  return Array.isArray(list) && list.every(item => typeof item === 'object');
}

function filterDirectories (list) {
  if (!isValidList(list)) {
    zaq.err('Invalid list provided to filterDirectories:', list);
    return null;
  }
  return list.filter(({ type }) => type !== 'directory');
}

function transformToHashList (list) {
  if (!isValidList(list)) {
    zaq.err('Invalid list provided to transformToHashList:', list);
    return null;
  }
  return list.filter(({ hash }) => hash).map(({ hash }) => hash);
}

function transformToFilenameList (list) {
  if (!isValidList(list)) {
    zaq.err('Invalid list provided to transformToFilenameList:', list);
    return null;
  }
  return list.map(({ name }) => name);
}

function getListIntersection (listA, listB) {
  return listA.filter(item => listB.includes(item));
}

function getListUniques (listA, listB) {
  return listA.filter(item => !listB.includes(item));
}

function findFileByHash (list, _hash) {
  return list.find(({ hash }) => hash === _hash);
}

function findFileByFilename (list, _name) {
  return list.find(({ name }) => name === _name);
}

function getCommonFilesByHash (fromList, toList) {
  const files = getCommonFiles(transformToHashList, fromList, toList);
  return files.map(hash => {
    const fromFile = findFileByHash(fromList, hash);
    const toFile = findFileByHash(toList, hash);
    return getMigrantFileStats(fromFile, toFile);
  });
}

function diverge (list, predicate) {
  if (!Array.isArray(list)) {
    zaq.err('Invalid list given to #diverge():', list);
    return null;
  } else if (typeof predicate !== 'function') {
    zaq.err('Invalid predicate fn given to #diverge():', predicate);
    return null;
  }
  const matches = [];
  const rejects = [];
  list.forEach(item => (predicate(item) ? matches : rejects).push(item));
  return [ matches, rejects ];
}

function generateObject (properties, defaultValue = null) {
  const output = {};
  if (!Array.isArray(properties)) return output;
  properties.forEach(prop => output[prop] = defaultValue);
  return output;
}

function getMigrantFileStats (fromFile, toFile) {
  const modified = (toFile.hash !== fromFile.hash);
  const migrated = (toFile.uri !== fromFile.uri);
  return {
    modified,
    migrated,
    type: toFile.type,
    name: toFile.name,
    toPath: toFile.uri,
    fromPath: fromFile.uri,
    toHash: toFile.hash,
    fromHash: fromFile.hash
  };
}

function getCommonFilesByFilename (fromList, toList) {
  const uniqueFromFiles = getOnlyUniqueFilenames(fromList);
  const uniqueToFiles = getOnlyUniqueFilenames(toList);
  const shared = getCommonFiles(transformToFilenameList, uniqueFromFiles, uniqueToFiles);
  return shared
    .map(filename => {
      const fromFile = findFileByFilename(fromList, filename);
      const toFile = findFileByFilename(toList, filename);
      return getMigrantFileStats(fromFile, toFile);
    });
}

function getOnlyUniqueFilenames (list) {
  if (!isValidList(list)) {
    zaq.err('Invalid list provided to getOnlyUniqueFilenames:', list);
    return null;
  }
  return getOnlyUniqueValues(list, ({ name }) => name);
}

function getOnlyUniqueValues (list, transformValueFn) {
  if (!Array.isArray(list)) {
    zaq.err('Invalid list provided to getOnlyUniqueValues:', list);
    return null;
  };
  if (typeof transformValueFn !== 'function')
    transformValueFn = (value) => value;

  const encounteredValues = [];
  const duplicatedValues = [];
  list.forEach(value => {
    const transformed = transformValueFn(value);
    if (encounteredValues.includes(transformed)) {
      if (!duplicatedValues.includes(transformed)) duplicatedValues.push(transformed);
    } else {
      encounteredValues.push(transformed);
    }
  });
  return list.filter(value => !duplicatedValues.includes(transformValueFn(value)));
}

function getCommonFiles (listMapperFn, ...lists) {
  if (!lists || !lists.length) {
    zaq.err('No lists provided to getCommonFiles.');
    return null;
  }
  if (lists && lists.length && lists.some(list => !isValidList(list))) {
    zaq.err('Invalid lists provided to getCommonFiles:', lists);
    return null;
  }
  if (typeof listMapperFn !== 'function')
    listMapperFn = (list) => list;
  const listSet = lists
    .map(filterDirectories)
    .map(listMapperFn);
  const [ initial, ...rest ] = listSet;
  const result = listSet.reduce((commonFiles, thisList) => {
    return getListIntersection(commonFiles, thisList);
  }, initial);
  return result;
}

function isParentStructure (fileItem = {}) {
  const { type, content } = fileItem;
  return type === 'directory'
    && Array.isArray(content)
    && content.some(subItem => typeof subItem !== 'string');
}

module.exports = {
  diverge,
  fileExists,
  dirExists,
  mapDirectory,
  flattenMap,
  getCommonFiles,
  generateObject,
  filterDirectories,
  getCommonFilesByHash,
  findFileByFilename,
  getCommonFilesByFilename,
  transformToHashList,
  transformToFilenameList,
  getOnlyUniqueValues,
  getListUniques,
  isValidList
};
