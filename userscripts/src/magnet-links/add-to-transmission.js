function parseRawHeaders(rawHeaderString) {
    const headers = {};
    const lines = rawHeaderString.split('\r\n');

    for ( const line of lines ) {
        if ( ! line.trim() ) continue; // skip empty lines
        const [key , ...rest] = line.split(':');
        const value = rest.join(':').trim();
        headers[key.toLowerCase()] = value;
    }
    headers.get = (key) => {
        return headers[key.toLowerCase()];
    };
    return headers;
}

async function addToTransmission(transmissionServerUrl , user , password , addUrl , downloadToDir) {
    const auth = 'Basic ' + btoa(`${user}:${password}`);

    let sessionId;
    // Step 1: Get session ID (required by Transmission)
    const getSessionId2 = async () => {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method : 'POST' ,
                url : transmissionServerUrl ,
                headers : {
                    'Authorization' : auth ,
                } ,
                body : JSON.stringify({}) ,
                onload : function (res) {
                    const res_headers = parseRawHeaders(res?.responseHeaders ?? '');
                    resolve(res_headers['x-transmission-session-id']);
                }
            });
        });
    };

    // Step 2: Add the URL
    const addTorrentUrl = async () => {
        const body = {
            method : 'torrent-add' ,
            arguments : {
                filename : addUrl
            }
        };
        if ( downloadToDir ) {
            body.arguments['download-dir'] = downloadToDir;
        }
        return new Promise((resolve , reject) => {
            const req = typeof GM_xmlhttpRequest === 'function'
                ? GM_xmlhttpRequest
                : typeof GM?.xmlhttpRequest === 'function'
                    ? GM?.xmlhttpRequest
                    : null;

            if ( ! req ) {
                alert('The GM_xmlhttpRequest() function is not available\n\nPlease add this line to your temper-monkey-bootstrapping-script.js:\n\n// @grant GM_xmlhttpRequest');
                reject({error : 'missing GM_xmlhttpRequest()'});
            }
            req({
                method : 'POST' ,
                url : transmissionServerUrl ,
                headers : {
                    'Authorization' : auth ,
                    'X-Transmission-Session-Id' : sessionId ,
                    'Content-Type' : 'application/json'
                } ,
                data : JSON.stringify(body) ,
                onload : function (res) {
                    if ( res.status < 200 || res.status >= 300 ) {
                        return reject(new Error(`Failed to add torrent: ${res.status} ${res.statusText}`));
                    }

                    try {
                        const json = JSON.parse(res.responseText);
                        if ( json.result !== 'success' ) {
                            return reject(new Error(`Transmission error: ${json.result}`));
                        }
                        resolve(json.arguments);
                    } catch (err) {
                        reject(new Error('Invalid JSON response from Transmission'));
                    }
                } ,
                onerror : function (err) {
                    reject(new Error('Network error while adding torrent'));
                }
            });
        });
    };


    // Main logic
    sessionId = await getSessionId2();
    // await getSessionId();
    const result = await addTorrentUrl();
    console.log('addTorrentUrl() result :' , result);
    return result;
}

module.exports = addToTransmission;
