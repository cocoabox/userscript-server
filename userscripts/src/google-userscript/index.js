const AI_OVERVIEW_CAPTIONS = [
    'ai による概要' ,
    'ai overview' ,
];

function tryHideIn(root = document) {
    // Find all elements in the root
    const elements = root.querySelectorAll('*');
    for ( const el of elements ) {
        const text = el.textContent.trim().toLowerCase();
        if ( AI_OVERVIEW_CAPTIONS.includes(text) ) {
            const parent = el.closest('div[jsname]');
            if ( parent ) {
                console.log('Removing AI overview:' , parent);
                parent.style.display = 'none';
                parent.style.opacity = '0%'; // Optional
            }
        }
    }
}

function observeMutations() {
    const observer = new MutationObserver(mutations => {
        for ( const mutation of mutations ) {
            for ( const node of mutation.addedNodes ) {
                if ( node.nodeType === Node.ELEMENT_NODE ) {
                    tryHideIn(node);
                }
            }
        }
    });

    observer.observe(document.body , {
        childList : true ,
        subtree : true ,
    });

    console.log('MutationObserver is running');
    // Also run once immediately on the initial page load
    tryHideIn();
}

//
// main
//
module.exports = (async function () {
    observeMutations();
})();
