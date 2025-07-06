const {watch} = require('chokidar');
const path = require('node:path');
const fs = require('node:fs');
const {packUserscript , packUserscripts , readBuildDir , hashDir} = require('./pack-userscripts');
const {EventEmitter} = require('node:events');

class LiveBuilder extends EventEmitter {
    #packagesDir;
    #buildDir;
    #onError;
    #onWarning;
    #watchInterval;
    #throwIfBuildFails;
    #pollForChange;
    #minify;
    #libDirs;
    #printReport;

    constructor(packageDir , buildDir , {
        libDirs ,
        onError ,
        onWarning ,
        watchInterval = 5000 ,
        startWatchNow = true ,
        throwIfBuildFails = false ,
        pollForChange = false ,
        minify = true ,
        forceBuildNow = true ,
        printReport = false ,
    } = {}) {
        super();
        this.#onError = typeof onError === 'function' ? onError : console.error;
        this.#onWarning = typeof onWarning === 'function' ? onWarning : console.warn;

        this.#libDirs = libDirs ?? [];
        this.#libDirs = Array.isArray(this.#libDirs) ? this.#libDirs : [this.#libDirs];

        this.#onWarning('Constructing live builder' , {
            watchInterval ,
            startWatchNow ,
            throwIfBuildFails ,
            pollForChange ,
            printReport ,
        });
        this.#printReport = printReport;

        fs.mkdirSync(buildDir , {recursive : true});
        fs.mkdirSync(packageDir , {recursive : true});
        this.#buildDir = path.resolve(buildDir);
        this.#packagesDir = path.resolve(packageDir);
        this.#watchInterval = watchInterval;
        this.#throwIfBuildFails = !! throwIfBuildFails;
        this.#pollForChange = !! pollForChange;
        this.#minify = minify;
        if ( forceBuildNow ) {
            this.buildAll({force : true})
                .finally(() => {
                    if ( startWatchNow ) this.watch();
                });
        } else {
            if ( startWatchNow ) this.watch();
        }
    }

    #watcher;

    #getAll() {
        return Object.fromEntries(fs.readdirSync(this.#packagesDir).map(nam => path.join(this.#packagesDir , nam)
        ).map(fullDirPath => {
            const packageJsonPath = path.join(fullDirPath , 'package.json');
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath , 'utf8'));
                const {name , userScript : {matches = null , isProduction = true}} = packageJson ?? {};
                if ( name ) {
                    return [name , {name , matches , dir : fullDirPath}];
                }
            } catch (read_error) {
                this.#onWarning('Will ignore :' , packageJsonPath);
            }
        }).filter(n => !! n));
    }

    #isBuilding = false;

    async #rebuild(dirtyPackages , {outputFilename = 'index.js' , forceBuild = false} = {}) {
        if ( this.#isBuilding ) {
            this.#onWarning(`[#rebuild] Already building (started on : ${this.#isBuilding})`);
            return;
        }
        this.#isBuilding = new Date();
        this.#onWarning('[#rebuild] Build start');

        // produce { *: {name, matches, dir} ,... } for all package source dirs
        const allUserScripts = this.#getAll();

        // produce { *: {name, folderHash, matches, content} ,... } for already-built-and-hash-valid from build cache
        const built = {};
        for ( const bd of await fs.promises.readdir(this.#buildDir) ) {
            const builtDir = path.join(this.#buildDir , bd);
            try {
                const p = await readBuildDir(builtDir);
                const {name , folderHash , matches , content} = p;
                if ( ! name ) continue;
                const srcDir = allUserScripts[name].dir;
                const currentHash = await hashDir(srcDir);
                if ( currentHash === folderHash )
                    built[name] = {name , folderHash , matches , content};
            } finally {
            }
        }
        const doBuild = async (name , dir) => {
            const packed = await packUserscript(dir , {
                buildDir : this.#buildDir ,
                isProduction : this.#minify ,
                onWarning : this.#onWarning ,
                onError : this.#onError ,
                printReport : this.#printReport ,
            });
            built[packed.name] = packed;
        };
        if ( '__all__' in dirtyPackages ) {
            // build all
            for ( const {name , dir} of Object.values(allUserScripts) ) {
                this.#onWarning(`Building ${name} at ${dir} because everything needs to be rebuilt`);
                await doBuild(name , dir);
            }
        } else {
            // build dirty packages (and all other non-built ones)
            const isDirty = (userScriptDir) => userScriptDir in dirtyPackages;
            for ( const {name , dir} of Object.values(allUserScripts) ) {
                const bIsDirty = isDirty(dir);
                const bIsntBuilt = !!! built[name];
                if ( bIsDirty || bIsntBuilt || forceBuild ) {
                    this.#onWarning(`Building ${name} at ${dir} because:` ,
                        Object.entries({bIsntBuilt , bIsDirty , forceBuild}).filter(([, v]) => !! v).map(([k ,]) => k)
                    );
                    await doBuild(name , dir);
                } else {
                    this.#onWarning(`Skipping ${name} because` , {bIsntBuilt , bIsDirty , forceBuild});

                }
            }
        }
        this.#onWarning('[#rebuild] assembling final output');

        // build final output
        const entryScriptContent = await packUserscripts(this.#packagesDir , {
            alreadyBuilt : built , // pass built content as a dict
            outputFilename ,
            buildDir : this.#buildDir ,
            isProduction : this.#minify ,
            onWarning : this.#onWarning ,
            onError : this.#onError ,
            printReport : this.#printReport ,
            forceBuild ,
        });

        this.emit('build-success' , {
            content : entryScriptContent ,
            path : path.join(this.#buildDir , outputFilename) ,
        });
        this.#onWarning('[#rebuild] Build done in' , Date.now() - this.#isBuilding , 'msec');
        this.#isBuilding = null;
    }

    watch() {
        const all = this.#getAll();
        const changedPathToPackageDir = (changedFilePath) => {
            for ( const dir of Object.values(all).map(a => a.dir) ) {
                if ( changedFilePath.startsWith(dir) ) return dir;
            }
        };
        const dirtyPackages = new Set();
        if ( this.#watcher ) {
            throw new Error('Already watching, please call .stopWatch() first');
        }
        const watchPath = path.resolve(this.#packagesDir);
        this.#watcher = watch([...this.#libDirs , watchPath] ,
            Object.assign({} ,
                {
                    ignoreInitial : true ,
                    persistent : true ,
                } ,
                this.#pollForChange ? {
                    usePolling : true ,
                    interval : this.#watchInterval ,
                    binaryInterval : this.#watchInterval ,
                } : {}
            )
        );
        this.#onWarning(`Watching: ${watchPath}`);

        this.#watcher.on('all' , (event , changedPath) => {
            const addEd = word => word.endsWith('e') ? word + 'd' : word + 'ed';
            this.#onWarning(`${changedPath} ${addEd(event)}`);
            const packageDir = changedPathToPackageDir(changedPath);
            dirtyPackages.add(packageDir ?? '__all__');
            // ^ not a package dir means it's a change made in libDirs (affects all user scripts)
        });

        setInterval(async () => {
            if ( dirtyPackages.size === 0 ) return;
            this.#onWarning('Need to rebuild because of changes in :' , dirtyPackages);
            const pkgDirsArray = [...dirtyPackages];
            dirtyPackages.clear();
            await this.#rebuild(pkgDirsArray);
        } , this.#watchInterval);

    }

    async buildAll({outputFilename = 'index.js' , force = false} = {}) {
        this.#onWarning(`Build everything from scratch without intermediates`);
        const startTime = Date.now();
        try {
            await this.#rebuild(['__all__'] , {
                outputFilename ,
                forceBuild : force ,
            });
            this.#onWarning('Build finished in' , Date.now() - startTime , 'msec');
        } catch (rebuild_error) {
            this.#onWarning('🔥 Build failed in' , Date.now() - startTime , 'msec, reason :' , rebuild_error);
        }
    }

    stopWatch() {
        if ( this.#watcher ) {
            this.#watcher.close().then(() => {
                this.#onWarning('Watcher stopped.');
            }).catch(err => {
                this.#onError('Error stopping watcher:' , err);
            });
            this.#watcher = null;
        } else {
            this.#onWarning('No active watcher to stop.');
        }
    }
}

module.exports = LiveBuilder;

if ( require.main === module ) {
    const args = [...process.argv];
    args.shift();
    args.shift();
    const userscriptsDir = args[0];
    args.shift();
    if ( ! userscriptsDir ) {
        console.error('Usage: live-builder.js <userscripts_dir>');
        process.exit(1);
    }

    const packagesDir = path.join(userscriptsDir , 'src');
    const buildDir = path.join(userscriptsDir , 'build');

    new LiveBuilder(packagesDir , buildDir ,
        {forceBuildNow : true});
}
