async function killVideoIframe() {

    const SELECTORS = [
        '.videoIframe' ,
        '.evp-player iframe' ,
    ];
    console.log('killVideoIframe' , SELECTORS);

    function replace(elem) {
        const div = document.createElement('div');
        div.textContent = 'video iframe removed by yahoo-news-userscript';
        div.style = 'color: purple; background: white; padding: 5px; font-size: 12px; border: 1px solid purple; border-radius: 3px';
        elem.replaceWith(div);
    }

    // Replace all existing matches
    SELECTORS.forEach(sel => {
        document.querySelectorAll(sel).forEach(replace);
    });

    // Replace any future matches
    new MutationObserver(mutations => {
        mutations.forEach(m => {
            m.addedNodes.forEach(n => {
                if ( ! (n instanceof HTMLElement) ) return;

                SELECTORS.forEach(sel => {
                    if ( n.matches?.(sel) ) return replace(n);
                    n.querySelectorAll?.(sel)?.forEach(replace);
                });
            });
        });
    }).observe(document.body , {childList : true , subtree : true});
}

module.exports = (async function () {
    await killVideoIframe();
})();
