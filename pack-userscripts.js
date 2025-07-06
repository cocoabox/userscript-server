const path = require('path');
const fs = require('fs');
const os = require('os');
const webpack = require('webpack');
const MemoryFS = require('memory-fs');
const _ = require('lodash');
const {promisify} = require('util');
const {hashElement} = require('folder-hash');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

const mkdtemp = promisify(fs.mkdtemp);
const rm = promisify(fs.rm); // Requires Node.js v14.14.0+

const fallback = {
    fs : false ,                  // no filesystem in browser
    http : false ,
    https : false ,
    path : require.resolve('path-browserify') ,
    buffer : require.resolve('buffer/') ,
    stream : require.resolve('stream-browserify') ,
    util : require.resolve('util/') ,
    assert : require.resolve('assert/') ,
    crypto : require.resolve('crypto-browserify') ,
    os : require.resolve('os-browserify/browser') ,
    zlib : require.resolve('browserify-zlib') ,
};

async function hashDir(dir) {
    return (await hashElement(dir , {
        folders : {exclude : ['node_modules']} ,
    })).hash;
}

function runWebpack(compiler , outputFileName , {onError , onWarning , printReport} = {}) {
    onError = typeof onError === 'function' ? onError : console.error;
    onWarning = typeof onWarning === 'function' ? onWarning : console.warn;

    const memfs = new MemoryFS();
    compiler.outputFileSystem = memfs;

    return new Promise((resolve , reject) => {
        compiler.run((err , stats) => {
            const info = stats.toJson();
            if ( err ) {
                onError('❌ Webpack error:' , err);
                return reject(err);
            }
            if ( stats.hasErrors() ) {
                onError('❌ Compilation errors:');
                info.errors.forEach(e => {
                    const err = {...e};
                    const {message , details , stack} = err;
                    delete err.message;
                    delete err.details;
                    onError(err);
                    onError('🔴 Stack :' , stack);
                    onError('🔴 Message :' , message);
                    onError('🔴 Details :' , details);
                });
                return reject(info.errors);
            }

            if ( stats.hasWarnings() ) {
                onWarning('⚠️ Compilation warnings:');
                info.warnings.forEach(onWarning);
            }

            if ( printReport )
                onWarning(stats.toString({
                        colors : printReport?.colors ?? true ,
                        chunks : printReport?.chunks ?? true ,
                        modules : printReport?.modules ?? true ,
                        assets : printReport?.assets ?? true ,
                        version : printReport?.version ?? true ,
                        timings : printReport?.timings ?? true ,
                    }).split('\n')
                        .map(line => `${' '.repeat((printReport?.indent ?? 1) * 4)}${line}`)
                        .join('\n')
                );

            // write output to disk
            try {
                const content = memfs.readFileSync(`/${outputFileName}` , 'utf-8');
                resolve(content);
            } catch (readErr) {
                reject(readErr);
            }
        });
    }); // return new Promise
}

/**
 *
 * @param scriptDir
 * @param isProduction
 * @param defaultMatches
 * @param onError
 * @param onWarning
 * @return {Promise<{content:string,name:string,matches:string[]|string,folderHash:string}>}
 */
async function _packUserscript(scriptDir , {
    isProduction = '?' ,
    onError ,
    onWarning ,
    printReport ,
    includePolyfill = false ,
} = {}) {
    onError = typeof onError === 'function' ? onError : console.error;
    onWarning = typeof onWarning === 'function' ? onWarning : console.warn;

    const packageJsonPath = path.join(scriptDir , 'package.json');
    const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath , 'utf8'));
    const mainFile = packageJson?.main ?? 'index.js';
    isProduction = isProduction === '?' ? (packageJson?.userScript?.isProduction ?? true) : isProduction ?? true;
    const matches = packageJson?.userScript?.matches;
    if ( ! matches ) {
        throw new Error(`.userScript.matches is missing from ${scriptDir}/package.json`);
    }
    const name = packageJson?.name ?? 'noname';
    const entryFile = path.join(scriptDir , mainFile);
    const folderHash = (await hashElement(scriptDir , {
        folders : {exclude : ['node_modules']} ,
    })).hash;


    const mode = isProduction ? 'production' : 'development';
    onWarning(`Building ${scriptDir}, mode=${mode}`);

    const outputFileName = 'bundle.js';
    const compiler = webpack({
        mode ,
        entry : entryFile ,
        output : {
            path : '/' ,
            filename : outputFileName ,
            libraryTarget : 'umd' ,         // Universal Module Definition (doesn't expose to global)
            globalObject : 'this' ,         // This makes it work in both browsers and Node
        } ,
        target : 'web' ,
        resolve : {
            alias : {
                fs : path.resolve(__dirname , path.join('frontend-utils' , 'local-storage-fs.js')) ,
                ui : path.resolve(__dirname , path.join('frontend-utils' , 'ui.js')) ,
                msgbox : path.resolve(__dirname , path.join('frontend-utils' , 'msgbox.js')) ,
            } ,
            fallback ,
        } ,
        module : {
            rules : []
        } ,
        plugins : [
            includePolyfill ? new NodePolyfillPlugin() : null ,
            new webpack.ProvidePlugin({
                process : path.resolve(__dirname , path.join('frontend-utils' , 'fake-process.js')) ,
            })
        ].filter(n => !! n) ,
    });
    const content = await runWebpack(compiler , outputFileName , {
        onError , onWarning , printReport ,
    });
    return {content , name , matches , folderHash};
}

function generateFromTemplate(templateBody , loopItems) {
    const loopStartTag = '/* loop-start */';
    const loopEndTag = '/* loop-end */';

    const startIdx = templateBody.indexOf(loopStartTag);
    const endIdx = templateBody.indexOf(loopEndTag);

    if ( startIdx === -1 || endIdx === -1 || endIdx <= startIdx ) {
        throw new Error('Loop tags not found or in wrong order.');
    }

    const beforeLoop = templateBody.slice(0 , startIdx + loopStartTag.length);
    const loopTemplate = templateBody.slice(startIdx + loopStartTag.length , endIdx);
    const afterLoop = templateBody.slice(endIdx);

    const generatedLoop = loopItems.map(item => {
        return loopTemplate
            .replace(/\/\* matches \*\//g , JSON.stringify(item?.matches))
            .replace(/\/\* require-name \*\//g , JSON.stringify(item.requireName))
            .replace(/\/\* name \*\//g , JSON.stringify(item.name));
    }).join('\n');

    return [beforeLoop , generatedLoop , afterLoop]
        .map(str => str.replace(/\/\* date \*\//g , (new Date).toLocaleString()))
        .join('\n\n');
}


async function packUserscript(scriptDir , {
    buildDir ,
    isProduction = '?' ,
    onError ,
    onWarning ,
    printReport
} = {}) {
    onError = typeof onError === 'function' ? onError : console.error;
    onWarning = typeof onWarning === 'function' ? onWarning : console.warn;
    const scriptDirBasename = path.basename(scriptDir);
    try {
        const {name , content , matches , folderHash} = await _packUserscript(scriptDir ,
            {
                isProduction ,
                onError ,
                onWarning ,
                printReport ,
            });
        if ( buildDir ) {
            await fs.promises.mkdir(path.join(buildDir , scriptDirBasename) , {recursive : true});
            await fs.promises.writeFile(path.join(buildDir , scriptDirBasename , 'bundle.js') , content , 'utf8');
            await fs.promises.writeFile(path.join(buildDir , scriptDirBasename , 'info.json') , JSON.stringify(
                {folderHash , matches , name}) , 'utf8');
        }
        return {name , content , matches , folderHash};
    } catch (error) {
        console.error('Error running _packUserscript() :' , error);
        onError({error});
        return {error};
    }
}

async function readBuildDir(buildDir) {
    const infoJsonPath = path.join(buildDir , 'info.json');
    if ( ! fs.existsSync(infoJsonPath) ) return {};

    const {name , folderHash , matches} = JSON.parse(await fs.promises.readFile(infoJsonPath , 'utf8')) ?? {};
    return {
        name , folderHash , matches , content : await fs.promises.readFile(path.join(buildDir , 'bundle.js') , 'utf8') ,
    };
}

async function packUserscripts(srcDir , {
    isProduction = '?' ,
    defaultMatches = '*://*/*' ,
    forceBuild = false ,
    onError ,
    onWarning ,
    alreadyBuilt , // { *: { content:*, name:*, matches:*, folderHash:* }, ... }
    buildDir ,
    ouputFilename ,
    printReport ,
} = {}) {
    onError = typeof onError === 'function' ? onError : console.error;
    onWarning = typeof onWarning === 'function' ? onWarning : console.warn;
    alreadyBuilt = alreadyBuilt ?? {};

    const isUserScriptDir = (userScriptDir) => {
        return fs.existsSync(path.join(userScriptDir , 'package.json'));
    };
    const getUserScriptName = async (userScriptDir) => {
        return JSON.parse(await fs.promises.readFile(path.join(userScriptDir , 'package.json') , 'utf8'))?.name;
    };

    const tempDir = await mkdtemp(path.join(os.tmpdir() , 'build-'));
    try {
        const userScripts = [];
        for ( const dirName of await fs.promises.readdir(srcDir) ) {
            const scriptDir = path.join(srcDir , dirName);
            if ( ! isUserScriptDir(scriptDir) )
                continue;
            const userScriptName = await getUserScriptName(scriptDir);
            const currentHash = (await hashElement(scriptDir , {
                folders : {exclude : ['node_modules']} ,
            })).hash;
            const isAlreadyBuilt = alreadyBuilt[userScriptName]?.folderHash === currentHash;
            if ( isAlreadyBuilt ) {
                onWarning(`${userScriptName} : is already built`);
                const {content , name , matches} = alreadyBuilt[userScriptName];
                const jsPath = path.join(tempDir , `${name}.js`);
                await fs.promises.writeFile(jsPath , content , 'utf8');
                userScripts.push({
                    name ,
                    matches ,
                    requireName : `./${name}.js` ,
                });
            } else {
                // not found in alreadyBuilt
                onWarning(`${userScriptName} : is not built (or hash mismatch), building`);
                try {
                    const {name , content , matches , folderHash} = await packUserscript(scriptDir ,
                        {
                            isProduction ,
                            defaultMatches ,
                            onError ,
                            onWarning ,
                            buildDir ,
                            printReport ,
                        });
                    const jsPath = path.join(tempDir , `${name}.js`);
                    await fs.promises.writeFile(jsPath , content , 'utf8');
                    userScripts.push({
                        name ,
                        matches ,
                        requireName : `./${name}.js` ,
                    });
                } catch (err) {
                    onError(`Error building from ${dirName} :` , err);
                    throw err;
                }
            }
        }
        const entryPointBody = generateFromTemplate(
            await fs.promises.readFile(path.join(__dirname , 'userscript-entrypoint-template.js') , 'utf8') ,
            userScripts ,
        );
        const entryFilePath = path.join(tempDir , 'index.js');
        await fs.promises.writeFile(entryFilePath , entryPointBody , 'utf8');
        await fs.promises.writeFile(path.join(tempDir , 'package.json') , JSON.stringify({
            name : 'user-script' ,
            main : 'index.js' ,
            version : '1' ,
        }) , 'utf8');

        const mode = isProduction ? 'production' : 'development';
        onWarning(`Webpack: entrypoint=${entryFilePath}, mode=${mode}`);
        const outputFileName = 'entrypoint.js';
        const compiler = webpack({
            mode ,
            entry : entryFilePath ,
            output : {
                path : '/' ,
                filename : outputFileName ,
                libraryTarget : 'umd' ,         // Universal Module Definition (doesn't expose to global)
                globalObject : 'this' ,         // This makes it work in both browsers and Node
            } ,
            target : 'web' ,
            resolve : {fallback} ,
            module : {
                rules : []
            }
        });
        const content = await runWebpack(compiler , outputFileName ,
            {onError , onWarning , printReport});
        await rm(tempDir , {recursive : true , force : true});
        if ( !! buildDir && !! outputFileName ) {
            const outputFullPath = path.join(buildDir , outputFileName);
            onWarning(`Write to: ${outputFullPath}`);
            await fs.promises.mkdir(path.dirname(outputFullPath) , {recursive : true});
            await fs.promises.writeFile(outputFullPath , content , 'utf8');
        } else {
            onWarning('Wont write output because :' , {buildDir , outputFileName});
        }
        return content;
    } catch (error) {
        await rm(tempDir , {recursive : true , force : true});
        throw error;
    }
}

module.exports = {packUserscript , packUserscripts , hashDir , readBuildDir};

if ( require.main === module ) {
    (async () => {
        const args = [...process.argv];
        args.shift();
        args.shift();
        const mode = args[0];
        args.shift();
        const inputDir = args[0];
        args.shift();
        const hasOpt = (optName) => {
            return args.map(a => a.toLowerCase()).includes(`--${optName.toLowerCase()}`);
        };

        if ( ! inputDir || ! inputDir ) {
            console.error('Usage: pack.js one <script_dir> [--development]');
            console.error('Usage: pack.js all <src_dir> [--development]');
            process.exit(1);
        }
        const opts = {};
        if ( hasOpt('development') ) {
            opts.isProduction = false;
        }

        try {
            if ( mode === 'one' ) {
                const absPath = path.resolve(process.cwd() , inputDir);
                const {content} = await packUserscript(absPath , opts);
                process.stdout.write(content);
            } else if ( mode === 'all' ) {
                const absPath = path.resolve(process.cwd() , inputDir);
                const content = await packUserscripts(absPath , opts);
                process.stdout.write(content);
            }
        } catch (err) {
            console.error('Error during bundling:' , err);
            process.exit(1);
        }

    })();
}
