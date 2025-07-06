const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const compression = require('compression');
const LiveBuilder = require('./live-builder');
const configStorageMiddleware = require('./storage-middleware');
const os = require('os');

class UserscriptServer {
    #liveBuilder;
    #buildDir;
    #onError;
    #onWarning;
    #app;
    #port;
    #minify;
    #hostname;

    constructor(userscriptDir , {
        hostname ,
        port = 8088 ,
        onError ,
        onWarning ,
        watchPoll = false ,
        watchIntervalSec = 5 ,
        minify = '?' ,
        printReport = false ,
        storageDir = `${__dirname}/storage` ,
        storageEndpointPrefix = '/storage' ,
    } = {}) {
        this.#onError = typeof onError === 'function' ? onError : console.error;
        this.#onWarning = typeof onWarning === 'function' ? onWarning : console.warn;
        this.#port = port;
        this.#hostname = hostname ?? os.hostname();
        this.#minify = minify;
        this.#onWarning('Minify option:' , minify === true ? 'always' : minify === false ? 'never' : 'depends on package.json');
        this.#onWarning('Constructing userscript server' , {
            userscriptDir ,
            port ,
            watchPoll ,
            watchIntervalSec
        });
        this.#app = express();
        this.#app.use(compression());
        this.#app.use(configStorageMiddleware({
            storageDir ,
            endpointPrefix : storageEndpointPrefix ,
        }));
        this.#app.use((req , res , next) => {
            res.set('Connection' , 'close');
            next();
        });
        // this.#app.use((req , res , next) => {
        //     res.setHeader('Access-Control-Allow-Origin' , '*');
        //     res.setHeader('Access-Control-Allow-Methods' , 'GET,POST,PUT,DELETE,OPTIONS');
        //     res.setHeader('Access-Control-Allow-Headers' , 'Content-Type,Authorization');
        //     next();
        // });
        this.#app.get('/full.js' , this.#onGetFullScriptJs.bind(this));
        this.#app.get('/full.user.js' , this.#onGetFullScriptJs.bind(this));
        this.#app.get('/lite.user.js' , this.#onGetLiteScriptJs.bind(this));
        this.#app.get('/us.js' , this.#onGetUserscriptJs.bind(this));
        this.#app.get('/' , this.#onGetRoot.bind(this));

        const packageDir = path.join(userscriptDir , 'src');
        this.#buildDir = path.join(userscriptDir , 'build');
        // setup Live Builder to rebuild goodies cache when anything changes
        if ( ! watchPoll ) {
            this.#onWarning('.watchPoll is false; this relies on FS events; changes via AFP might not get reflected');
        }
        this.#liveBuilder = new LiveBuilder(packageDir , this.#buildDir , {
            onError : this.#onError ,
            onWarning : this.#onWarning ,
            watchInterval : watchIntervalSec * 1000 ,
            pollForChange : watchPoll ,
            minify : this.#minify ,
            printReport ,
            libDirs : [
                `${__dirname}/frontend-utils` ,
            ] ,
        });
        this.#liveBuilder.on('build-success' , this.#onBuildSuccess.bind(this));
        this.#liveBuilder
            .buildAll({force : true})
            .finally(() => {
                this.#app.listen(this.#port , () => {
                    this.#onWarning(`Server started on http://localhost:${this.#port}`);
                });
            });
    }

    async #getFullScript() {
        const {date , content} = this.#userScriptContentCache;
        const body = await fs.promises.readFile(
            path.join(__dirname , 'temper-monkey-bootstrapping-script.js') ,
            'utf8' ,
        );
        const final_out =
            body.split('\n').map(a => a.replace(/^\/\/ @require .*?\/us\.js$/ , '//')).join('\n')
            + '\n\n'
            + content;
        return final_out;
    }

    #sendLiteScript(res) {
        const bootstrap_script_path = path.join(__dirname , 'temper-monkey-bootstrapping-script.js');
        fs.readFile(bootstrap_script_path , 'utf8' ,
            (err , bootstrap_script_str) => {
                if ( err ) return res.status(500).send(`/* error reading : ${bootstrap_script_path} */`);
                res.send(
                    bootstrap_script_str
                        .replaceAll('{{hostname}}' , this.#hostname)
                        .replaceAll('{{port}}' , this.#port)
                );
            });

    }

    async #onGetLiteScriptJs(req , res) {
        if ( ! this.#userScriptContentCache ) {
            this.#pending_res = res;
            try {
                await this.#liveBuilder.buildAll();
            } catch (error) {
                this.#onError('Build error:' , error);
                this.#userScriptContentCache = this.#userScriptContentCache ?? {};
                this.#userScriptContentCache.error = {
                    date : new Date() ,
                    error
                };
            }
        }
        const {date} = this.#userScriptContentCache ?? {};
        res.setHeader('Content-Type' , 'application/javascript');

        if ( ! date ) {
            res.status(404);
            res.send('/* nothing available; this.#userScriptContentCache seems to be empty */');
            return;
        }
        res.setHeader('Last-Modified' , date.toUTCString());
        res.setHeader('X-Created-Date' , date.toISOString());
        this.#sendLiteScript(res);
    }

    async #onGetFullScriptJs(req , res) {
        if ( ! this.#userScriptContentCache ) {
            this.#pending_res = res;
            try {
                await this.#liveBuilder.buildAll();
            } catch (error) {
                this.#onError('Build error:' , error);
                this.#userScriptContentCache = this.#userScriptContentCache ?? {};
                this.#userScriptContentCache.error = {
                    date : new Date() ,
                    error
                };
            }
        }
        const {date} = this.#userScriptContentCache ?? {};
        res.setHeader('Content-Type' , 'application/javascript');

        if ( ! date ) {
            res.status(404);
            res.send('/* nothing available; this.#userScriptContentCache seems to be empty */');
            return;
        }
        res.setHeader('Last-Modified' , date.toUTCString());
        res.setHeader('X-Created-Date' , date.toISOString());
        res.send(await this.#getFullScript());
    }

    #userScriptContentCache;

    #onBuildSuccess({content} = {}) {
        this.#userScriptContentCache = {content , date : new Date()};
        if ( this.#pending_res ) {
            this.#replyUserScript(this.#pending_res);
            this.#pending_res = null;
        }
    }

    #pending_res;

    async #onGetRoot(req , res) {
        if ( ! this.#userScriptContentCache ) {
            this.#pending_res = res;
            try {
                await this.#liveBuilder.buildAll();
            } catch (error) {
                this.#onError('Build error:' , error);
                this.#userScriptContentCache = this.#userScriptContentCache ?? {};
                this.#userScriptContentCache.error = {
                    date : new Date() ,
                    error
                };
            }
        }

        function escapeHTML(str) {
            return str
                .replace(/&/g , '&amp;')
                .replace(/</g , '&lt;')
                .replace(/>/g , '&gt;')
                .replace(/"/g , '&quot;')
                .replace(/'/g , '&#039;');
        }

        res.send(`<!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>User script server</title></head><style>
            a.link { padding: 1em; margin: .5em .25em; font-size: 15pt; display: block; }
            body { text-align: center; }
        </style><body>
        <a class="link" href="full.user.js">Full Script</a>
        <a class="link" href="lite.user.js">Lite Script</a>
        </body></html>`);
    }

    async #onGetUserscriptJs(req , res) {
        if ( ! this.#userScriptContentCache ) {
            this.#pending_res = res;
            try {
                await this.#liveBuilder.buildAll();
            } catch (error) {
                this.#onError('Build error:' , error);
                this.#userScriptContentCache = this.#userScriptContentCache ?? {};
                this.#userScriptContentCache.error = {
                    date : new Date() ,
                    error
                };
            }
        }
        this.#replyUserScript(res);

    }

    #replyUserScript(res) {
        const {date , content} = this.#userScriptContentCache ?? {};
        if ( ! date ) {
            res.status(400);
            res.setHeader('Content-Type' , 'application/javascript');
            res.send('// #userScriptContentCache is empty ; probably something didnt compile');
            return;
        }
        res.setHeader('Content-Type' , 'application/javascript');
        res.setHeader('Last-Modified' , date.toUTCString());
        res.setHeader('X-Created-Date' , date.toISOString());
        res.send(content);
    }


}

module.exports = UserscriptServer;

if ( require.main === module ) {
    const userscriptDir = process.argv[2];
    if ( ! userscriptDir ) {
        console.error('Usage: userscript-server.js <userscripts_dir>');
        process.exit(1);
    }
    new UserscriptServer(userscriptDir);
}
