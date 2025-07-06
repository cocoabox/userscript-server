const {fadeOutThenRemove , createButton , isStillThere , isVisible} = require('ui');


//
// non-intrusively offers to kill modal dialogs (and restore scrolling interaction)
//
function restoreInteraction() {
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.documentElement.style.pointerEvents = 'auto';
    document.body.style.pointerEvents = 'auto';
    document.documentElement.style.position = 'static';
    document.body.style.position = 'static';
    ['wheel' , 'mousewheel' , 'touchmove' , 'scroll'].forEach((event) => {
        window.addEventListener(
            event ,
            (e) => {
                e.stopPropagation();
            } ,
            {capture : true , passive : false}
        );
    });
    window.addEventListener('keydown' , (e) => {
        const blockedKeys = ['ArrowUp' , 'ArrowDown' , 'PageUp' , 'PageDown' , 'Home' , 'End' , ' '];
        if ( blockedKeys.includes(e.key) ) {
            e.stopPropagation();
        }
    } , {capture : true});

    console.log('[detect-modals]' , 'Scroll/key/mouse interactions restored');
}


async function detectModalOverlays(callback) {
    function isModalOverlay(el) {
        return new Promise(async (resolve) => {
            if ( ! (el instanceof HTMLElement) ) return resolve(false);
            const style = window.getComputedStyle(el);
            const renderedWidth = el.offsetWidth;
            const renderedHeight = el.offsetHeight;

            const coversViewport =
                renderedWidth >= window.innerWidth * .75 ||
                renderedHeight >= window.innerHeight * .75;

            if ( style.position === 'fixed' ) {
                console.debug('[detect-modals]' , 'position is fixed' , {
                    el ,
                    coversViewport ,
                    renderedWidth ,
                    renderedHeight ,
                    wih : window.innerHeight ,
                    wiw : window.innerWidth ,
                });
                if ( await isVisible(el , {timeout : 150}) ) {
                    // console.debug('[detect-modals]' , 'is visible');
                    return resolve(coversViewport);
                } else {
                    // console.debug('[detect-modals]' , 'not visible');
                    return resolve(false);
                }
            } else {
                console.debug('[detect-modals]' , `position is ${style.position}` , {el , coversViewport});
            }

            return resolve(false);
        });
    }


    async function inspect(el) {
        if ( await isModalOverlay(el) ) {
            callback(el);
        }
        for ( const child of el.children ) {
            await inspect(child);
        }
    }

    // Initial DOM scan
    inspect(document.body);

    // Set up MutationObserver for future modals
    const observer = new MutationObserver((mutations) => {
        for ( const mutation of mutations ) {
            mutation.addedNodes.forEach((node) => {
                if ( node instanceof HTMLElement ) {
                    inspect(node);
                }
            });
        }
    });

    observer.observe(document.body , {
        childList : true ,
        subtree : true ,
    });

    console.log('Robust modal overlay detector is running...');
}

function killOverlay(el) {
    // Safely remove or hide the modal
    if ( el && el.remove ) {
        el.remove();
        console.log('[detect-modals]' , 'Overlay removed:' , el);
    } else {
        console.warn('[detect-modals]' , 'Unable to remove overlay:' , el);
    }
}


function onModal(el) {
    let button_countdown = 8;
    const button_fadeout_sec = 3;
    const button_caption = ({sec = 5 , displayName = el?.id ?? 'Overlay'} = {}) =>
        `✖ ${displayName ? displayName : 'Overlay'} (${sec})`;

    // create a button on the bottom left of the screen
    const btn = createButton(
        button_caption({sec : 5}) , {
            parent : document ,
            extraStyles : {
                position : 'fixed' ,
                bottom : '10px' ,
                left : '10px' ,
                zIndex : '999999999' ,
                transition : 'opacity 0.3s ease' ,
            } ,
            onClick : () => {
                console.log('button onclick');
                killOverlay(el);
                restoreInteraction();
                clearInterval(buttonGoAwayTimer);
                clearInterval(updateCheckTimer);
                btn.remove();
            } ,
        }
    );

    const buttonGoAwayTimer = setInterval(() => {
        button_countdown--;
        btn.textContent = button_caption({sec : button_countdown});
        if ( button_countdown > 0 ) {
            // do nothing
        } else {
            clearInterval(updateCheckTimer);
            clearInterval(buttonGoAwayTimer);
            fadeOutThenRemove(btn , button_fadeout_sec);
        }
    } , 1000);

    const updateCheckTimer = setInterval(async () => {
        if ( ! await isStillThere(el) || await isVisible(el) === false ) {
            console.log('overlay is no longer there/visible' , el);
            clearInterval(buttonGoAwayTimer);
            clearInterval(updateCheckTimer);
            btn.remove();
        }
    } , 300);


    document.body.appendChild(btn);
}

async function detectModals() {
    console.debug('[detect-modals]' , 'start');
    await detectModalOverlays(onModal);
}

module.exports = detectModals;
