// entrypoint.js
(async function () {
    function match(pattern , subject) {
        const escaped = pattern.replace(/[-[\]/{}()+?.\\^$|]/g , '\\$&');
        const regexPattern = '^' + escaped.replace(/\*/g , '.*') + '$';
        const regex = new RegExp(regexPattern);
        return regex.test(subject);
    }

    function toArray(a) {
        return Array.isArray(a) ? a : [a];
    }

    function toPromise(ret) {
        return typeof ret?.then === 'function' ? ret : Promise.resolve(ret);
    }
    // WARNING: do not change the following block-comments because they are used in inline string-replacement
    // to generate the final user script
    console.log('=> Userscript built on /* date */ now running on', document.URL);
    /* loop-start */
    if ( toArray(/* matches */).some(pattern => match(pattern , window.location.href)) ) {
        console.log(`=> Running userscript: /* name */`);
        try {
            const req = require(/* require-name */);
            const ret = typeof req === 'function' ? req() : req;
            await toPromise(ret);
        } catch (error) {
            console.error(`=> Userscript /* name */ error :` , error);
        }
    }

    /* loop-end */
    console.log('=> All userscripts finished on', document.URL);

})();
