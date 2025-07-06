#!/usr/bin/env node

const json5 = require('json5');
const fs = require('node:fs');
const path = require('node:path');
var os = require('node:os');

const UserscriptServer = require('./userscript-server');

function resolveUserscriptDirPath(confJsonPath , configJson) {
    let userscriptsDir = configJson?.userscripts_dir;
    if ( ! userscriptsDir ) return path.join(__dirname , 'userscript');

    if ( userscriptsDir && ! path.isAbsolute(userscriptsDir) ) {
        const confJsonDir = path.dirname(confJsonPath); // Directory of the app.json
        userscriptsDir = path.resolve(confJsonDir , userscriptsDir);    // Resolve relative path to absolute
    }

    return userscriptsDir;
}


if ( require.main === module ) {

    const confDir = path.join(__dirname , 'conf');
    const confPath = path.join(confDir , 'userscript-server.json5');
    const confJson = json5.parse(fs.readFileSync(confPath , 'utf8'));
    const userscriptsDir = resolveUserscriptDirPath(confPath , confJson);
    const port = confJson?.port ?? 8088;
    const hostname = confJson?.hostname ?? os.hostname();
    const printReport = confJson?.printReport;
    const minify = confJson?.minify ?? '?';
    const watchPoll = !! confJson?.watch?.poll;
    const watchIntervalSec = confJson?.watch?.interval_sec;
    new UserscriptServer(userscriptsDir , {
        hostname,
        port ,
        watchPoll ,
        watchIntervalSec ,
        minify ,
        printReport ,
    });
}


