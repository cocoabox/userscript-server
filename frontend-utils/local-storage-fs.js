const localStorageFs = {
    writeFileSync(path , data) {
        if ( typeof data !== 'string' ) {
            data = JSON.stringify(data); // auto-serialize
        }
        localStorage.setItem(path , data);
    } ,

    async writeFile(path , data) {
        return new Promise((resolve , reject) => {
            try {
                this.writeFileSync(path , data);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    } ,

    readFileSync(path , encoding = 'utf8') {
        const value = localStorage.getItem(path);
        if ( value === null ) {
            throw new Error(`File not found: ${path}`);
        }

        if ( encoding === 'utf8' ) return value;
        if ( encoding === 'json' ) return JSON.parse(value);
        throw new Error(`Unsupported encoding: ${encoding}`);
    } ,

    async readFile(path , encoding = 'utf8') {
        return new Promise((resolve , reject) => {
            try {
                resolve(this.readFileSync(path , encoding));
            } catch (err) {
                reject(err);
            }
        });
    } ,

    existsSync(path) {
        return localStorage.getItem(path) !== null;
    } ,

    async exists(path) {
        return new Promise((resolve) => {
            resolve(this.existsSync(path));
        });
    } ,

    unlinkSync(path) {
        localStorage.removeItem(path);
    } ,

    async unlink(path) {
        return new Promise((resolve , reject) => {
            try {
                this.unlinkSync(path);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    } ,

    readdirSync(prefix = '') {
        return Object.keys(localStorage).filter(key => key.startsWith(prefix));
    } ,

    async readdir(prefix = '') {
        return new Promise((resolve) => {
            resolve(this.readdirSync(prefix));
        });
    } ,

    // JSON helpers
    readJSONSync(path) {
        return JSON.parse(this.readFileSync(path));
    } ,

    async readJSON(path) {
        return new Promise((resolve , reject) => {
            try {
                resolve(this.readJSONSync(path));
            } catch (err) {
                reject(err);
            }
        });
    } ,

    writeJSONSync(path , obj) {
        this.writeFileSync(path , JSON.stringify(obj));
    } ,

    async writeJSON(path , obj) {
        return new Promise((resolve , reject) => {
            try {
                this.writeJSONSync(path , obj);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }
};

// Adding .promises namespace
localStorageFs.promises = {
    writeFile : localStorageFs.writeFile.bind(localStorageFs) ,
    readFile : localStorageFs.readFile.bind(localStorageFs) ,
    exists : localStorageFs.exists.bind(localStorageFs) ,
    unlink : localStorageFs.unlink.bind(localStorageFs) ,
    readdir : localStorageFs.readdir.bind(localStorageFs) ,
    readJSON : localStorageFs.readJSON.bind(localStorageFs) ,
    writeJSON : localStorageFs.writeJSON.bind(localStorageFs) ,
};

// Exporting the module
module.exports = localStorageFs;
