const {waitForSelector , onAjaxLocationChange , whenThisAppears , waitForTextNode , sleep} = require('ui');
const createSaveChatButton = require('./create-save-chat-button');

async function chatgptAuth() {

}


async function onWelcomePage() {
    try {
        const button = await waitForSelector('button[data-testid="login-button"]');
        console.log('got login button:' , button);
        button.click();
        const timer_id = setInterval(() => {
            const classList = button.classList;
            if ( ! classList.contains('cursor-not-allowed') ) {
                console.log('Button is enabled again, clicking...');
                button.click();
                clearInterval(timer_id);
            }
        } , 300);

    } catch (error) {
        console.warn('login button click failed because' , error);
    }
}

async function onChatPage() {
    const timeoutForButtonToAppear = 5;
    const selector = [
        '[data-testid="modal-no-auth-imagegen-nux"]' ,
        '[data-testid="modal-no-auth-rate-limit"]' ,
    ].join(',');

    whenThisAppears(selector , async (node) => {
        console.log('[onChatPage] no-auth dialog has appeared' , node);
        const startTime = Date.now();
        const expireTime = startTime + timeoutForButtonToAppear * 1000;
        while (true) {
            if ( Date.now() >= expireTime ) {
                console.warn(`[onChatPage] could not find button after ${timeoutForButtonToAppear} sec`);
                return;
            }
            const button = await waitForTextNode('Stay logged out' , {closestSelector : 'button, a'});
            if ( button ) {
                console.log('[onChatPage] will now click button:' , button);
                button.click();
                return;
            }
            await sleep(200);
        }
    } , {all : false , once : true});

    await createSaveChatButton();
}

async function onLoginPage() {
    console.log('[onLoginPage]' , typeof GM_xmlhttpRequest);
    const onChange = (url) => {
        const urlObj = new URL(url);
        if ( urlObj.pathname === '/log-in' )
            console.log('TODO: enter email address');
        else if ( urlObj.pathname === '/log-in/password' )
            console.log('TODO: enter password');
    };
    onAjaxLocationChange(onChange);
    onChange(window.location);
}


module.exports = async function () {
    if ( window?.location?.href === 'https://chatgpt.com/auth/login' ) {
        await onWelcomePage();
    } else if ( window.location?.hostname === 'auth.openai.com' ) {
        await onLoginPage();
    } else if ( window.location?.href?.startsWith('https://chatgpt.com/') ) {
        await onChatPage();
    }
};
