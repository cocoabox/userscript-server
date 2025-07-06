const {getConfig , setConfig} = require('./transmission-config');

const {confirmMagnetAdd} = require('./user-interface');
const add_to_transmission = require('./add-to-transmission');

function getAbsoluteUrl(href) {
    const currentUrl = window.location.href;
    const absoluteUrl = new URL(href, currentUrl);
    return absoluteUrl.href;
}

//
// entrypoint for magnet-link-related userscript
//
module.exports = (async function () {
    async function onMagnetClick(event , magnetLink) {
        event.preventDefault(); // Prevent default navigation
        console.log('Magnet link clicked:' , magnetLink);
        if (magnetLink.startsWith('magnet:')) {
            //
        }
        else {
            magnetLink = getAbsoluteUrl(magnetLink);
        }

        // TODO: move these to browser storage
        // TODO: use better UI; hopefully a DOM box with a tabbed UI that allows user to change transmission config
        // const wantsToAdd = window.confirm(`🧲 Add to ${host}:${port}?\n\n${magnetLink}`);
        const wantsToAdd = await confirmMagnetAdd(magnetLink ,
            getConfig() ,
            {
                onLoad : async () => {
                    const out = getConfig();
                    alert(`Config Loaded\n\n${JSON.stringify(out , '' , 4)}`);
                    return out;
                } ,
                onSave : async (userConf) => {
                    setConfig(userConf);
                    alert('Config Saved\n\nThanks');
                } ,
            });
        if ( wantsToAdd ) {
            const {host , port = 9091 , username , password , ssl , download_dir} = getConfig();
            if ( ! host || ! username || ! password ) {
                alert('Sorry\n\nMissing configuration');
                return;
            }

            try {
                const transmissionUrl = `${ssl ? 'https' : 'http'}://${host}:${port}/transmission/rpc`;
                const res = await add_to_transmission(transmissionUrl , username , password , magnetLink , download_dir);

                window.alert(`🤗 Thanks. This is what ${host}:${port} had to say:\n\n${JSON.stringify(res , '' , 4)}`);
                // ^ example: {
                //     "torrent-added": {
                //         "hashString": "733d63bdc54897927738f9ef94e3d77e27061514",
                //         "id": 342,
                //         "name": "[SubsPlease] Witch Watch - 05 (720p) [88A33290].mkv"
                //     }
                // }
            } catch (error) {
                window.alert(`🔥 Sorry\n\n${error}`);
            }
        }
    }

    // Attach click handler to a single magnet link
    function interceptLink(link) {
        if ( link.dataset.magnetHandled ) return; // Avoid duplicate handlers
        link.dataset.magnetHandled = 'true';

        link.addEventListener('click' , (event) => {
            const href = link.getAttribute('href');
            if ( href && (href.startsWith('magnet:') || href.endsWith('.torrent')
            ) ) {
                onMagnetClick(event , href);
            }
        });
    }

    // Find and intercept all existing magnet links
    function interceptAllExistingLinks() {
        const links = document.querySelectorAll('a[href^="magnet:"], a[href$=".torrent"]');
        links.forEach(interceptLink);
    }

    // Observe for future magnet links
    function observeNewLinks() {
        const observer = new MutationObserver((mutations) => {
            for ( const mutation of mutations ) {
                for ( const node of mutation.addedNodes ) {
                    if ( node.nodeType === 1 ) {
                        if ( node.matches && (node.matches('a[href^="magnet:"]') || node.matches('a[href$=".torrent"]'))
                        ) {
                            interceptLink(node);
                        } else {
                            const nestedLinks = node.querySelectorAll?.('a[href^="magnet:"]') || [];
                            nestedLinks.forEach(interceptLink);
                        }
                    }
                }
            }
        });

        observer.observe(document.body , {
            childList : true ,
            subtree : true
        });
    }

    // Initialize
    interceptAllExistingLinks();
    observeNewLinks();
})();
