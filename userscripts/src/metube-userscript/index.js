const msgbox = require('msgbox');

const {request , createButton} = require('ui');

// constants
const metubeURL = 'http://192.168.11.8:8081';
const buttonBackground = '#ff4444';
const buttonCaption = 'meTube';

async function meTube() {

    // Function to send request to MeTube
    async function addToMeTube() {
        // Change button state to working
        metubeButton.textContent = 'working';
        metubeButton.disabled = true;
        metubeButton.style.cursor = 'not-allowed';
        metubeButton.style.backgroundColor = '#999';

        function restoreButton() {
            metubeButton.textContent = buttonCaption;
            metubeButton.disabled = false;
            metubeButton.style.cursor = 'pointer';
            metubeButton.style.backgroundColor = buttonBackground;
        }

        const currentUrl = window.location.href;
        const title = document.querySelector('meta[property="og:title"]')?.content
            ?? document.querySelector('video[class*="html5-main-video"]')?.title
            ?? currentUrl;
        const formatChoice = await msgbox({
            title ,
            text : 'Download this video in which format?' ,
            buttons : {
                'any' : 'Any' ,
                'mp4' : 'mp4' ,
                'm4a' : 'm4a' ,
                'cancel' : 'Cancel' ,
            } ,
            esc_key : 'cancel' ,
            return_key : 'any' ,
        });
        if ( formatChoice === 'cancel' ) {
            restoreButton();
            return;
        }

        const format = {
            any : 'any' ,
            mp4 : 'mp4' ,
            m4a : 'm4a' ,
        }[formatChoice];

        const request_body = {
            url : currentUrl ,
            quality : 'best' ,
            format ,
            custom_name_prefix : '' ,
            playlist_strict_mode : false ,
            auto_start : true
        };

        console.log('[metube]  calling /add; request body is' , request_body);

        try {
            const res = await request({
                url : `${metubeURL}/add` ,
                method : 'POST' ,
                expects_json : true ,
                request_body ,
                send_json : true ,
            });
            const {response_data , status_code} = res;
            if ( status_code !== 200 ) {
                console.error('non 200 returned' , res);
                throw new Error('non 200 returned from metube');
            }
            const {status} = response_data ?? {};

            if ( status === 'ok' ) {
                // Show success modal using msgbox
                const choice = await msgbox({
                    buttons : {dismiss : 'Dismiss' , open : 'Open MeTube'} ,
                    return_key : 'open' ,
                    esc_key : 'dismiss' ,
                    title : 'Link successfully added to MeTube' ,
                    text : 'Video might take a while to download.' ,
                });

                if ( choice === 'open' ) {
                    window.open(`${metubeURL}/` , '_blank');
                }
            } else {
                window.alert('Error: Server did not return OK status');
            }
        } catch (error) {
            console.error('Error adding to MeTube:' , error);
            window.alert(`Error connecting to MeTube server : ${error}`);
        } finally {
            // Revert button state
            restoreButton();
        }
    }

    // Create and add the button to the page
    const metubeButton = createButton(buttonCaption , {
        id : 'metube-button' ,
        extraStyles : {
            position : 'fixed' ,
            top : '10px' ,
            left : '10px' ,
            zIndex : '10000' ,
            backgroundColor : buttonBackground ,
            color : 'white' ,
        } ,
    });

    metubeButton.addEventListener('click' , addToMeTube);

    // Add button to page
    document.body.appendChild(metubeButton);

    // Handle YouTube's dynamic page changes
    let currentUrl = window.location.href;
    const observer = new MutationObserver(() => {
        if ( window.location.href !== currentUrl ) {
            currentUrl = window.location.href;
            // Button should persist across page changes
            if ( ! document.getElementById('metube-button') ) {
                document.body.appendChild(metubeButton);
            }
        }
    });

    observer.observe(document.body , {
        childList : true ,
        subtree : true
    });
}

module.exports = meTube;
