const serverStorage = {
    /**
     * reads a JSON/text file from the userscript server
     * @param {string} filename
     * @param {string='/storage'} endpointPrefix
     * @param {boolean=true} isJson
     * @return {Promise<Object|string>}
     * @throws {Error} if gm_xmlhttprequest is unavilable or request failure
     */
    read(filename , {
        endpointPrefix = '/storage' ,
        isJson = true ,
    } = {}) {
        return new Promise((resolve , reject) => {
            const gmxhr_func = GM_xmlhttpRequest ?? GM?.xmlHttpRequest;
            if ( typeof gmxhr_func !== 'function' ) {
                return reject(new Error('GM_xmlhttpRequest is not available'));
            }

            gmxhr_func({
                method : 'GET' ,
                url : `${endpointPrefix}/${filename}` ,
                headers : {} ,
                data : null ,
                onload : (response) => {
                    if ( response.status >= 200 && response.status < 300 ) {
                        try {
                            if ( isJson ) {
                                resolve(JSON.parse(response.responseText));
                            } else {
                                resolve(response.responseText);
                            }
                        } catch (parseErr) {
                            reject(new Error(`Failed to parse JSON response: ${parseErr.message}`));
                        }
                    } else {
                        reject(new Error(`HTTP error ${response.status}: ${response.responseText}`));
                    }
                } ,
                onerror : (err) => {
                    reject(new Error(`Request failed: ${err}`));
                } ,
            });
        });
    } ,

    /**
     * writes and overwrites a JSON/text file on userscript server
     * @param {string} filename
     * @param {string|object} data
     * @param {string='/storage'} endpointPrefix
     * @param {boolean=true} isJson
     * @return {Promise<boolean>}
     * @throws {Error} if gm_xmlhttprequest is unavilable or request failure
     */
    write(filename , data , {
        endpointPrefix = '/storage' ,
        isJson = true ,
    } = {}) {
        return new Promise((resolve , reject) => {
            const gmxhr_func = GM_xmlhttpRequest ?? GM?.xmlHttpRequest;
            if ( typeof gmxhr_func !== 'function' ) {
                return reject(new Error('GM_xmlhttpRequest is not available'));
            }

            const payload = isJson ? JSON.stringify(data) : data;
            const headers = isJson ? {'Content-Type' : 'application/json'} : {};

            gmxhr_func({
                method : 'POST' ,
                url : `${endpointPrefix}/${filename}` ,
                headers ,
                data : payload ,
                onload : (response) => {
                    if ( response.status >= 200 && response.status < 300 ) {
                        resolve(true);
                    } else {
                        reject(new Error(`HTTP error ${response.status}: ${response.responseText}`));
                    }
                } ,
                onerror : (err) => {
                    reject(new Error(`Request failed: ${err}`));
                } ,
            });
        });
    } ,

    append(filename , data , {
        endpointPrefix = '/storage' ,
        isJson = true ,
    } = {}) {
        return new Promise((resolve , reject) => {
            const gmxhr_func = GM_xmlhttpRequest ?? GM?.xmlHttpRequest;
            if ( typeof gmxhr_func !== 'function' ) {
                return reject(new Error('GM_xmlhttpRequest is not available'));
            }

            const payload = isJson ? JSON.stringify(data) : data;
            const headers = isJson ? {'Content-Type' : 'application/json'} : {};

            gmxhr_func({
                method : 'PATCH' ,
                url : `${endpointPrefix}/${filename}` ,
                headers ,
                data : payload ,
                onload : (response) => {
                    if ( response.status >= 200 && response.status < 300 ) {
                        resolve(true);
                    } else {
                        reject(new Error(`HTTP error ${response.status}: ${response.responseText}`));
                    }
                } ,
                onerror : (err) => {
                    reject(new Error(`Request failed: ${err}`));
                } ,
            });
        });
    } ,
};

module.exports = serverStorage;
