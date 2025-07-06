const Ui = {
    onLoad : function (doThis) {
        console.log('[onLoad]' , doThis);
        window.addEventListener('load' , doThis);
    } ,
    sleep : function (msec) {
        return new Promise(resolve => {
            window.setTimeout(resolve , msec);
        });
    } ,
    selectIncludingFuture : async function (selector , onGotElements , {root} = {}) {
        const seen = new WeakSet();

        function processElements(root = document) {
            if ( ! root.querySelectorAll ) return;
            root.querySelectorAll(selector).forEach(el => {
                if ( ! seen.has(el) ) {
                    seen.add(el);
                    onGotElements(el);
                }
            });
        }

        // Process existing elements
        root = root ?? window.document;
        processElements(root);
        // Observe future additions to the DOM
        const observer = new MutationObserver(mutations => {
            for ( const mutation of mutations ) {
                mutation.addedNodes.forEach(node => {
                    if ( node.nodeType !== 1 ) return; // Element nodes only

                    if ( node.matches && node.matches(selector) ) {
                        if ( ! seen.has(node) ) {
                            seen.add(node);
                            onGotElements(node);
                        }
                    }

                    // Scan subtree
                    processElements(node);
                });
            }
        });
        observer.observe(document.body , {
            childList : true ,
            subtree : true ,
        });
    } ,
    whenThisAppears : async function (selector , asyncCallback , {all = false , once = false , interval = 500} = {}) {
        let isRunning = false;
        const callUserCallback = async (...args) => {
            if ( isRunning ) {
                console.warn('[whenThisAppears] not calling user callback because prev call is still in progress');
                return;
            }
            isRunning = true;
            await asyncCallback(...args);
            isRunning = false;
        };
        let timer = setInterval(async () => {
            if ( all ) {
                const nodes = document.querySelectorAll(selector);
                if ( 0 === nodes.length ) return;
                await callUserCallback(nodes);
                if ( once ) clearInterval(timer);
            } else {
                const node = document.querySelector(selector);
                if ( ! node ) return;
                await callUserCallback(node);
                if ( once ) clearInterval(timer);
            }
        } , interval);
        return timer;
    } ,
    watchForChanges : async function (parentSelector , callback , {subtree = true} = {}) {
        console.log(`[monitorDom] will monitor ${parentSelector}`);
        const targetNode = document.querySelector(parentSelector);
        const config = {
            childList : true ,       // Observe direct children
            subtree ,               // Observe all descendants
            characterData : true ,   // Observe changes to text content
        };
        const cb = function (mutationsList , observer) {
            console.log(`[monitorDom] was monitoring ${parentSelector}; got change :` , mutationsList);
            callback({selector : parentSelector , mutationsList , observer});
        };
        const observer = new MutationObserver(cb);
        if ( targetNode ) {
            observer.observe(targetNode , config);
        } else {
            console.warn('Element not found:' , parentSelector);
        }
    } ,
    selectTextNode : async function (searchForText , {searchIn , closestSelector} = {}) {
        searchIn = searchIn ?? document.body;
        const walker = document.createTreeWalker(document.body , NodeFilter.SHOW_TEXT , {
            acceptNode : function (node) {
                return node.nodeValue.trim() === searchForText ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
        });
        const textNode = walker.nextNode(); // The actual text node
        if ( closestSelector ) {
            return textNode?.parentElement?.closest(closestSelector);
        } else {
            return textNode;
        }
    } ,
    waitForTextNode : function (searchForText , {closestSelector , timeout = 3000 , interval = 100} = {}) {
        return new Promise((resolve , reject) => {
            const startTime = Date.now();
            const check = async () => {
                const node = await Ui.selectTextNode(searchForText , {closestSelector});
                if ( node ) {
                    clearInterval(checkTimer);
                    resolve(node);
                } else if ( Date.now() - startTime >= timeout ) {
                    clearInterval(checkTimer);
                    reject(new Error(`Timeout: Text node "${searchForText}" not found within ${timeout}ms`));
                }
            };
            const checkTimer = setInterval(check , interval);
        });
    } ,
    /**
     * wait for items to appear
     * @param {string} selector
     * @param {number} interval
     * @param {number} timeout
     * @param {boolean} all
     * @return {Promise<Node|NodeList>}
     */
    waitForSelector : async function (selector , {interval = 100 , timeout = 5000 , all = false} = {}) {
        console.log('[waitForSelector]' , selector);
        const {document} = window;
        if ( ! document ) {
            console.error('window.document not found');
            return;
        }
        return new Promise((resolve , reject) => {
            let elapsedTime = 0;

            const check = () => {
                const result = all ? document.querySelectorAll(selector) : document.querySelector(selector);
                const found = all ? result.length > 0 : result !== null;

                if ( found ) {
                    clearInterval(interval);
                    clearTimeout(timer);
                    resolve(result);
                } else if ( (elapsedTime += interval) >= timeout ) {
                    clearInterval(interval);
                    reject(new Error(`Timeout: Element${all ? 's' : ''} "${selector}" not found within ${timeout}ms`));
                }
            };

            const checkTimer = setInterval(check , interval);
            const timer = setTimeout(() => {
                clearInterval(checkTimer);
                reject(new Error(`Timeout: Element${all ? 's' : ''} "${selector}" not found within ${timeout}ms`));
            } , timeout);

            check(); // Initial immediate check
        });
    } ,
    onAjaxLocationChange : function (doThis) {
        const pushState = history.pushState;
        const replaceState = history.replaceState;

        history.pushState = function (...args) {
            const result = pushState.apply(this , args);
            window.dispatchEvent(new Event('locationchange'));
            return result;
        };

        history.replaceState = function (...args) {
            const result = replaceState.apply(this , args);
            window.dispatchEvent(new Event('locationchange'));
            return result;
        };

        window.addEventListener('popstate' , () => {
            window.dispatchEvent(new Event('locationchange'));
        });

        window.addEventListener('locationchange' , () => {
            console.log('Location changed to:' , window.location.href);
            doThis(window.location.href);
        });
    } ,
    /**
     *
     * @param {string='GET'} method
     * @param {string} url
     * @param {string|object} request_body
     * @param {object={}} request_headers
     * @param {boolean=true} expects_json
     * @param {boolean=true} send_json
     * @return {Promise<{response_header, response_data, status_code}>}
     */
    request : async (
        {
            method = 'GET' ,
            url ,
            request_body ,
            request_headers = {} ,
            expects_json = true ,
            send_json = true ,
        } = {}
    ) => {
        // Check if GM.xmlHttpRequest is available (userscript environment)
        const gmxhr_func = GM_xmlhttpRequest ?? GM?.xmlHttpRequest;
        if ( 'function' === typeof gmxhr_func ) {
            console.log('calling GM.xmlHttpRequest');
            return new Promise((resolve , reject) => {
                const data = send_json ? JSON.stringify(request_body) : `${request_body}`;
                const req = {
                    method : method.toUpperCase() ,
                    url : url ,
                    headers : request_headers ,
                    data ,
                    url : url ,
                    onload : (response) => {
                        try {
                            console.log('>>' , response);

                            let response_data = response.responseText;
                            // Parse JSON if expected and response is not empty
                            if ( expects_json && response_data && response_data.trim() ) {
                                try {
                                    const parsed = JSON.parse(response_data);
                                    response_data = parsed;
                                } catch (parseError) {
                                    console.warn('Failed to parse JSON response:' , parseError);
                                }
                            }

                            // Parse response headers into an object
                            const response_headers = {};
                            if ( response.responseHeaders ) {
                                response.responseHeaders.split('\r\n').forEach(header => {
                                    const [key , ...valueParts] = header.split(':');
                                    if ( key && valueParts.length > 0 ) {
                                        response_headers[key.trim().toLowerCase()] = valueParts.join(':').trim();
                                    }
                                });
                            }

                            resolve({
                                response_data ,
                                response_headers ,
                                status_code : response.status
                            });
                        } catch (error) {
                            reject(error);
                        }
                    } ,
                    onerror : (error) => {
                        reject(new Error(`GM.xmlHttpRequest error: ${error.error || 'Unknown error'}`));
                    } ,
                    ontimeout : () => {
                        reject(new Error('GM.xmlHttpRequest timeout'));
                    }
                };
                console.log('[req] making GM.xmlHttpRequest call to:' , req);
                gmxhr_func(req);
            });
        }
        // Fallback to fetch API
        else {
            console.log('calling fetch (warning: CORS restrictions may cause this script to fail)');
            try {
                const fetchOptions = {
                    method : method.toUpperCase() ,
                    headers : request_headers
                };

                // Add body for methods that support it
                if ( request_body && ['POST' , 'PUT' , 'PATCH' , 'DELETE'].includes(method.toUpperCase()) ) {
                    fetchOptions.body = send_json ? JSON.stringify(request_body) : request_body;
                }

                const response = await fetch(url , fetchOptions);

                let response_data;
                if ( expects_json ) {
                    try {
                        response_data = await response.json();
                    } catch (parseError) {
                        // If JSON parsing fails, get text instead
                        response_data = await response.text();
                    }
                } else {
                    response_data = await response.text();
                }

                // Convert Headers object to plain object with lowercase keys
                const response_headers = {};
                response.headers.forEach((value , key) => {
                    response_headers[key.toLowerCase()] = value;
                });

                return {
                    response_data ,
                    response_headers ,
                    status_code : response.status
                };
            } catch (error) {
                throw new Error(`Fetch error: ${error.message}`);
            }
        }
    } ,
    msgbox : (msg , {title = ''} = {}) => {
        window.alert(`${title}\n\n${msg}`.trim());
    } ,

    fadeOutThenRemove : (elem , sec = 3) => {
        // Trigger fade-out then remove()
        elem.style.transition = `opacity ${sec}s ease-out`;
        elem.style.opacity = '0';
        setTimeout(() => {
            if ( elem.parentNode ) elem.remove();
        } , sec * 1000);
    } ,

    createButton : (caption , {extraStyles , parent = document , onClick = null , id = null} = {}) => {
        extraStyles = extraStyles ?? {};
        const btn = parent.createElement('button');
        btn.textContent = caption;
        console.log('[createButton]' , {caption , parent});
        if ( id ) btn.id = id;
        const style = Object.assign({
            position : 'fixed' ,
            zIndex : '999999999' ,
            padding : '10px 15px' ,
            background : '#35e59c' ,
            color : '#000' ,
            border : 'none' ,
            borderRadius : '5px' ,
            fontSize : '14px  !important' ,
            cursor : 'pointer  !important' ,
            boxShadow : '0 2px 5px rgba(0,0,0,0.3)' ,
            transition : 'opacity 0.3s ease' ,
        } , extraStyles);
        console.log('[createButton]' , 'style' , style);

        for ( const [styleKey , styleVal] of Object.entries(style) ) {
            btn.style[styleKey] = styleVal;
        }

        if ( onClick ) {
            console.log('[createButton]' , 'onClick' , onClick);
            btn.addEventListener('click' , onClick);
        }
        // Add button to page
        (parent === document ? document.body : parent).appendChild(btn);

        return btn;
    } ,
    isStillThere : async (el) => {
        if ( ! el ) return false;
        return document.body.contains(el);
    } ,

    isVisible : (el , {timeout = 150} = {}) => {
        return new Promise(resolve => {
            if ( ! el ) return false;
            if ( typeof el.checkVisibility === 'function' ) {
                setTimeout(() => {
                    if ( false === el.checkVisibility() ) {
                        return resolve(false);
                    } else return resolve(true);
                } , timeout);
            }
        });
    } ,
};
module.exports = Ui;
