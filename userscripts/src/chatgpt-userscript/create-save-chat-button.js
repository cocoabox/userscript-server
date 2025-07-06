const {sleep , createButton} = require('ui');
const msgbox = require('msgbox');

function chat2html(chat , title) {
    const css = `body,pre{font-family:helvetica,arial,san-serif}body{padding:1em;background:#303030;color:#fff;font-size:14pt;line-height:1.8em}dt{color:rgba(255,255,255,.5);font-weight:700}img{ max-width: 100%; height: auto; display: block;}pre.user{white-space:pre-wrap;}dd>ul{list-style: none; margin: 0; padding :0;}dd>ul>li{ margin: 0; padding :0; }`;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="initial-scale = 1.0,maximum-scale = 1.0" /><style type="text/css">${css}</style><title>${title}</title></head><body><dl>` +
        chat.map(({from , from_user , from_bot , body}) => {
            let dt = '';
            let dd = '';
            if ( from_user ) {
                dt = from;
                if ( body.length === 1 ) {
                    const tag = 'pre';
                    if ( typeof body[0] === 'string' ) {
                        dd = `<${tag} class="user">${body[0]}</${tag}>`;
                    } else if ( body[0]?.mimeType?.startsWith('image/') ) {
                        dd = `<img src="${body[0].data}" />`;
                    } else {
                        dd = 'unknown';
                    }
                } else if ( body.length > 1 ) {
                    const list = body.map(b => {
                        const tag = 'pre';
                        if ( typeof b === 'string' ) {
                            return `<li><${tag} class="user">${b}</${tag}></li>`;
                        } else if ( b?.mimeType.startsWith('image/') ) {
                            return `<li><img src="${b.data}" /></li>`;
                        } else {
                            return '<li>unknown</li>';
                        }
                    });
                    dd = '<ul>' + list.join('') + '</ul>';
                }
            } else if ( from_bot ) {
                dt = from;
                if ( body.length === 1 ) {
                    if ( typeof body[0] === 'string' ) {
                        dd = body[0];
                    } else if ( body[0]?.mimeType?.startsWith('image/') ) {
                        dd = `<img src="${body[0].data}" />`;
                    } else {
                        dd = 'unknown';
                    }
                } else if ( body.length > 1 ) {
                    const list = body.map(b => {
                        if ( typeof b === 'string' ) {
                            return `<li>${b}></li>`;
                        } else if ( b?.mimeType.startsWith('image/') ) {
                            return `<li><img src="${b.data}" /></li>`;
                        } else {
                            return '<li>unknown</li>';
                        }
                    });
                    dd = '<ul>' + list.join('\n') + '</ul>';
                }

            }
            return `<dt>${dt}</dt><dd>${dd}</dd>`;
        }).join('\n') + '</dl></body></html>';
    return html;
}

async function download_file(bodyStr , {type = 'application/json' , filename = 'chat.json'} = {}) {
    const blob = new Blob([bodyStr] , {type});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

function scroll_into_view(element , options = {}) {
    return new Promise((resolve) => {
        // Scroll the element into view
        element.scrollIntoView(options);

        // Create an intersection observer to check if the element is in view
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if ( entry.isIntersecting ) {
                    // If the element is in view, resolve the promise
                    resolve();
                    // Disconnect the observer
                    observer.disconnect();
                }
            });
        });
        observer.observe(element);
    });
}

async function wait_for_element(query_from , selector , {timeout = 1000 , interval = 500} = {}) {
    console.log(`waiting for "${selector}" from"` , query_from);
    let timed_out = false;
    let timer = setTimeout(() => {
        console.warn('timed out');
        timed_out = true;
    } , timeout);
    while (true) {
        let selected;
        selected = query_from.querySelector(selector);
        if ( selected ) {
            clearTimeout(timer);
            console.log(`got "${selector}" from` , query_from , '-->' , selected);
            return selected;
        }
        await sleep(interval);
        if ( timed_out ) throw new Error('timed out');
    }
}

async function download_image(image_url) {
    const response = await fetch(image_url);
    if ( ! response.ok ) throw new Error('Failed to fetch image');

    const blob = await response.blob();
    const mimeType = blob.type;
    const reader = new FileReader();

    return new Promise((resolve , reject) => {
        reader.onloadend = () => resolve({mimeType , data : reader.result});
        reader.onerror = () => reject(new Error('Failed to read blob'));
        reader.readAsDataURL(blob);
    });
}

async function get_image_data(img_tag) {
    return new Promise((resolve , reject) => {
        try {
            // Ensure the img_tag is a valid HTMLImageElement
            if ( ! (img_tag instanceof HTMLImageElement) ) {
                return reject(new Error('Invalid image tag'));
            }
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = img_tag.width;
            canvas.height = img_tag.height;
            context.drawImage(img_tag , 0 , 0);
            const dataUrl = canvas.toDataURL();
            const mimeType = dataUrl.split(';')[0].split(':')[1];
            return resolve({
                data : dataUrl.split(',')[1] , // Base64 data
                mimeType : mimeType
            });
        } catch (error) {
            console.warn('get_image_data failed' , {img_tag , error});
            return reject({error});
        }
    });
}

function find_current_chat_btn() {
    const match = window.location.href.match(/(\/c\/.*)$/);
    const href = match ? match[0] : null;
    if ( ! href ) return;
    return document.querySelector(`a[href="${href}"]`);
}

async function reload_chat() {
    const button_to_return = find_current_chat_btn();
    if ( ! button_to_return ) {
        console.warn('cannot reload because return-button not found');
        return;
    }
    const main_button = document.querySelector('a[href="/"]');
    if ( ! main_button ) {
        console.warn('cannot reload because main-button not found');
        return;
    }
    console.log('main' , main_button);
    main_button.click();
    await sleep(RELOAD_WAIT_MSEC);
    await wait_for_element(document.body , '.composer-parent #prompt-textarea' , {timeout : 30 * 1000});
    console.log('return' , button_to_return);
    button_to_return.click();
    await sleep(RELOAD_WAIT_MSEC);
    await wait_for_element(document.body , 'main .h-full svg[role="img"]' , {timeout : 30 * 1000});
}

function save_chat() {
    async function _do_save_chat() {
        const articles = document.querySelectorAll('main .h-full article');
        if ( ! articles ) {
            console.warn('no chat history found');
            return;
        }
        articles[0].parentElement.parentElement.scrollTo(0 , 0);
        const chat = [];
        const articles_arr = Array.from(articles);
        const tot = articles_arr.length - 1;
        let img_errs = [];
        let uncaught_errs = 0;
        for ( const [idx , article] of Object.entries(articles_arr) ) {
            console.log(`** message : ${idx}/${tot}` , article);
            await scroll_into_view(article);
            try {
                const msg = {
                    from : '' ,
                    from_user : false ,
                    from_bot : false ,
                    body : [] ,
                };
                const content = await wait_for_element(article , '.text-base');
                const h5 = article.querySelector('h5.sr-only');
                const h6 = article.querySelector('h6.sr-only');
                if ( h5 ) {
                    msg.from_user = true;
                    msg.from = h5.textContent?.match(/^(.*?):$/)?.[1] ?? h5.textContent ?? '(unknown)';
                } else if ( h6 ) {
                    msg.from_bot = true;
                    msg.from = h6.textContent?.match(/^(.*?):$/)?.[1] ?? h6.textContent ?? '(unknown)';
                }
                const dalle_images = content.querySelectorAll('.group\\/dalle-image');
                for ( const di of dalle_images ) {
                    const img = di.querySelector('img');
                    if ( img ) {
                        let img_content;
                        try {
                            img_content = await download_image(img.src);
                        } catch (err) {
                            img_errs.push('dall-e');
                        } finally {
                            msg.body.push(img_content);
                        }
                    }
                }
                const children = content.querySelector('[data-message-id] .w-full').children;
                for ( const child of children ) {
                    if ( Array.from(child.classList).includes('markdown') ) {
                        const cloned = child.cloneNode(true);
                        // remove buttons
                        const buttons = cloned.getElementsByTagName('button');
                        while (buttons.length > 0) {
                            buttons[0].parentNode.removeChild(buttons[0]);
                        }
                        // Find all tags inside the clonedDiv and remove all classes
                        for ( const elem of Array.from(cloned.getElementsByTagName('*')) ) {
                            if ( elem.classList.contains('text-token-text-secondary') ) {
                                if ( elem.textContent?.trim() )
                                    elem.textContent = `// ${elem.textContent}`;
                            }
                            elem.removeAttribute('class');
                        }

                        // Convert all <code> elements to their text content
                        const codes = cloned.getElementsByTagName('code');
                        for ( let i = codes.length - 1; i >= 0; i-- ) {
                            const code = codes[i];
                            if ( code.children.length === 0 ) continue;
                            // ^ e.g. <code>inlineFunc</code>

                            // complicated code block <code><span class="number">123</span></code>
                            // ↓
                            const {textContent} = code;
                            // const textNode = document.createTextNode(textContent);
                            // code.parentNode.replaceChild(textNode, code);
                            code.textContent = textContent;
                        }
                        msg.body.push(cloned.innerHTML.replaceAll(/<\/?div>/g , ''));
                    }
                    const paragraph = child.querySelector('.whitespace-pre-wrap');
                    if ( paragraph ) {
                        msg.body.push(paragraph.innerHTML);
                    }
                    try {
                        const img = child.querySelector('img');
                        if ( img ) {
                            msg.body.push(await download_image(img.src));
                        }
                    } catch (err) {
                        console.warn('failed to download img from' , child);
                        img_errs.push('general-img');
                    }
                }
                chat.push(msg);
            } catch (error) {
                console.error(`message ${idx} failed because :` , error);
                uncaught_errs++;
            }
        }
        const out = {chat , img_errs , uncaught_errs};
        console.log('Done!' , out);
        return out;
    }

    return new Promise(async resolve => {
        let {chat , img_errs , uncaught_errs} = await _do_save_chat() ?? {};
        console.log('result:' , {chat , img_errs , uncaught_errs});
        if ( ! chat?.length ) {
            await msgbox({text : 'No chat message captured.' , buttons : {ok : 'Sorry'}});
            return false;
        } else {
            const has_img_errs = img_errs?.length > 0;
            const title = find_current_chat_btn()?.textContent ?? `${document.title} (untitled)`;
            const html = chat2html(chat , title);
            const text = has_img_errs ? (`Some images could not be downloaded from "${title}". `
                    + "They are protected, and usually have to be downloaded quickly after page load.")
                : "Now ready for download";

            const choice = await msgbox({
                title ,
                text ,
                buttons : Object.assign({} ,
                    has_img_errs
                        ? {retry : 'Reload'}
                        : {html : 'Save as HTML' , json : 'Save as JSON'} ,
                    {close : '✖'} ,
                ) ,
                esc_key : 'close' ,
            });
            switch (choice) {
                case 'retry':
                    return resolve('retry');
                case 'html':
                    console.log(html);
                    await download_file(html , {type : 'text/html' , filename : `${document.title}.html`});
                    return resolve(true);
                case 'json':
                    console.log(chat);
                    await download_file(JSON.stringify(chat , '' , 4) , {filename : `${document.title}.json`});
                    return resolve(true);
            }
        }
    });
}

async function create_save_chat_button() {
    const saveChatButton = createButton('Save chat' , {
        id : 'save-chat-button' ,
        extraStyles : {
            position : 'fixed' ,
            top : '10px' ,
            left : '10px' ,
            zIndex : '10000' ,
            backgroundColor : '#4bd8ff' ,
            color : '#000' ,
        } ,
    });

    saveChatButton.addEventListener('click' , async () => {
        while (true) {
            // await reload_chat();
            const res = await save_chat();
            console.log('[save-chat]' , 'res=' , res);
            if ( res === 'retry' ) {
                console.log('will retry');
                await sleep(500);
                await reload_chat();
                continue;
            }
            break;
        }
    });

}

module.exports = create_save_chat_button;
