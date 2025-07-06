async function hideLoginWithGoggle() {
    // Function to hide Google login iframes
    function hideGoogleIframes() {
        [...document.querySelectorAll('iframe')].filter(a => a.src.startsWith('https://accounts.google.com/')).forEach(iframe => {
            if ( ! iframe ) return;
            console.log('[hideLoginWithGoggle] hide google login iframe' , iframe);
            iframe.style.display = 'none';
            if ( iframe.parentElement && iframe.parentElement.tagName.toUpperCase() === 'DIV' ) {
                iframe.parentElement.style.display = 'none';
            }
        });
    }

    // Run once immediately to catch any existing iframes
    hideGoogleIframes();

    // Create MutationObserver to watch for DOM changes
    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;

        mutations.forEach((mutation) => {
            // Check if nodes were added
            if ( mutation.type === 'childList' && mutation.addedNodes.length > 0 ) {
                mutation.addedNodes.forEach((node) => {
                    // Check if the added node is an iframe or contains iframes
                    if ( node.nodeType === Node.ELEMENT_NODE ) {
                        if ( node.tagName.toUpperCase() === 'IFRAME' || node.querySelector('iframe') ) {
                            shouldCheck = true;
                        }
                    }
                });
            }

            // Check if attributes were modified (like src attribute)
            if ( mutation.type === 'attributes' && mutation.target.tagName.toUpperCase() === 'IFRAME' ) {
                shouldCheck = true;
            }
        });

        // Only run the hiding function if we detected relevant changes
        if ( shouldCheck ) {
            hideGoogleIframes();
        }
    });

    // Start observing the document for changes
    observer.observe(document.body , {
        childList : true ,
        subtree : true ,
        attributes : true ,
        attributeFilter : ['src']
    });

    return observer;
}

module.exports = hideLoginWithGoggle;
