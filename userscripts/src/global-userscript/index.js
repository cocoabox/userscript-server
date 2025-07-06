const hideLoginWithGoggle = require('./hide-login-with-goggle');
const revealPassword = require('./reveal-password');
const detectModals = require('./detect-modals');

module.exports = (async function () {
    console.log('--global userscript START--');
    await hideLoginWithGoggle();
    await revealPassword();
    await detectModals();
    console.log('--global userscript END--');
})();
