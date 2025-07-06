const RegexEscape = require('regex-escape');

const keywords = ['suggested for you'];

function _hideArticles(root = document.body) {
    const regex_str = '(' + keywords.map(k => RegexEscape(k)).join('|') + ')';
    const walker = document.createTreeWalker(root , NodeFilter.SHOW_TEXT ,
        node => RegExp(regex_str , 'i').test(node.textContent)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT
    );

    let node;
    while (node = walker.nextNode()) {
        const article = node.parentElement.closest('article');
        if ( article ) {
            article.style.opacity = 0.00001;
            article.style.height = '1px';
            console.log('[instagram userscript] hiding suggested article' , article);
        }
    }
}

async function hideSuggested() {
    // Function to hide articles containing "suggested for you"


    // Hide existing articles
    _hideArticles();

    // Watch for future changes
    new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if ( node.nodeType === Node.ELEMENT_NODE ) {
                    _hideArticles(node);
                }
            });
        });
    }).observe(document.body , {childList : true , subtree : true});
}

//
// main
//
module.exports = (async function () {
    await hideSuggested();
})();
