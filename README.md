# Flyboy


Flyboy is a node-based CLI app that evaluates and augments the transition from one codebase organization to another.

## Basic Concepts

**Flyboy** has two main uses:

- **Mapping directory structures and saving that mapping** to a local JSON file. These files have the extension ".fmap.json", and are referred to as `fmap` files from here onward.
- **Performing operations based on a given initial state (map) and final state (map).** These are referred to as the "from" and "to" states, respectively. These can be given as actual directories, or as `fmap` files.


**Basic options:**

- Set the "from" (`-f <dir|fmap>` or `--from <dir|fmap>`) and "to" (`-t <dir|fmap>`, `--to <dir|fmap>`) options to directory paths that reference project start and end states.

- Set the "base" (`-b <dir>` or `--base <dir>`) option to specify the relative root/base when transitioning. **Defaults to current working directory.**

- To prevent having to specify the same options over and over, use a `.flyboyrc` JSON-format file in your project root containing the same options you'd pass via command-line, except use camelCase instead of snake-case. For instance, if you consistently use the option `--verbose`, set `{ "verbose": true }` in your config file.

	*Tip: This file can also be easily generated using the `flyboy config` command (see below).*



# Commands

## `flyboy map <inputDir> <outputFileName>`
Creates an `fmap` of the given <inputDir>. This file can be consumed flyboy as if it were an actual directory, and can preserve the state of a directory for later comparison or migration.

The map will be saved as `<outputFileName>.fmap.json` in the current working directory. Files with this dual extension are effectively ignored by flyboy when mapping directories.

## `flyboy config [...args]`
Pass arguments to the "config" command to save them as your default configuration.

For example, if you run the following:

```bash
flyboy config -f initialState.fmap.json -m ./src
```

The following `.flyboyrc` is generated:

```json
{
	"from": "initialState.fmap.json",
	"moduleRoot": "./src"
}
```


## `flyboy status`

Prints a table indicating the files which are to be added, removed, moved, or left untouched. Use with `-v/--verbose` to see the full list (by default, each table is limited to first 20 items).


## `flyboy rebase`

Rewrites destination file "import" statements to reflect changes in project architecture. Displays the list of changed statements and warns about any relative file paths that couldn't be resolved.

Affected import statements include:

- ES6-flavored `import` statements
- CSS/SCSS/LESS `@import` statements.
- _(Support for further import types would be a great addition, including `require()` imports and maybe even java class rewrite support!)_

Does a dry run unless the execute (-e) flag is given.

## `flyboy copy`

Copy known common files from source/"from" structure to destination/"to" structure. Useful to "undo" changes made to destination files. If you ran rebase, and have changed file/directory structure afterward, run copy to "reset" the files. 

Does a dry run unless the execute (-e) flag is given.

## `flyboy generate <git|svn>`

Generates a shell script (`flyboy-migrate.sh`) containing the git or svn mkdir/rm/mv commands, based on given from/to states.

Immediately run the script after generation by passing the execute (-e) flag.


# All CLI Options

|Short Option|Long Option|Config Key|Effect|
|:---|:---|:---|:---|
|`-V`|`--version`| |output the version number|
|`-f [dir]`|`--from [dir]`|`from (string or array[string])`|Set the "from" directory, representing the starting state. Optionally provide multiple directories separated by commas.
|`-t [dir]`|`--to [dir]`|`to (string or array[string])`|Set the "to" directory, representing the desired end state. Optionally provide multiple directories separated by commas.|
|`-b [dir]`|`--base [dir]`|`base (string)`|Set the "base" directory, representing the desired end state.|
|`-m [dir]`|`--module-root [dir]`|`moduleRoot (string)`|Set a webpack-style "module" root directory. When running "rebase", import paths will be relative to this root instead of to their respective source files.|
|`-v`|`--verbose`|`verbose (bool)`|Set verbose mode. This will show all tentative operations instead of limiting each type to 20 rows.|
|`-q`|`--quiet`|`quiet (bool)`|Set quiet mode. No forecast or other messages will be displayed (except errors!).|
|`-e`|`--execute`|`execute (bool)`|Destructive commands do a "dry run" unless this option is passed.|
|`-h`|`--help`| |output usage information|
