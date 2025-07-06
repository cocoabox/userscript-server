// user-interface.js

async function confirmMagnetAdd(magnetLink , config = {} , {onSave , onLoad} = {}) {
    return new Promise((resolve) => {
        const ui_id = 'magnet-links--user-interface';
        if ( document.getElementById(ui_id) ) {
            document.getElementById(ui_id).remove(); // clean previous if any
        }

        const container = document.createElement('div');
        container.id = ui_id;
        container.innerHTML = `
            <style>
                #${ui_id}-backdrop {
                    position: fixed; inset: 0;
                    background: rgba(0,0,0,0.4);
                    z-index: 9998;
                }
                #${ui_id}-modal {
                    position: fixed;
                    top: 50%; left: 50%;
                    transform: translate(-50%, -50%);
                    background: #fff;
                    padding: 1rem;
                    border-radius: 8px;
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    z-index: 9999;
                    max-width: 400px;
                    font-family: sans-serif;
                }
                .reveal-link {
                    color: #007aff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5em;
                    user-select: none;
                }
                .reveal-content {
                    margin-top: 0.5em;
                    display: none;
                }
                .reveal-content.open {
                    display: block;
                }
                .transmission-label {
                    display: block;
                    margin-top: 0.5em;
                }
                .transmission-label input {
                    width: 100%;
                    padding: 0.3em;
                    margin-top: 0.2em;
                }
                #${ui_id}-modal button {
                    margin-top: 1em;
                    margin-right: 0.5em;
                }
                #${ui_id}modal p:first-child {
                  margin-top: 0.5em;
                }
                .warn {
                    color: red;
                }
                .transmission-label input[type="checkbox"] {
                  width: auto;
                  display: inline-block;
                  margin: .5em 0;
                  vertical-align: middle;
                }
                .transmission-label input[type="checkbox"] + span {
                    margin-left: .5em; 
                }
                .transmission-label span {
                    color: #666;
                    font-weight: normal;
                }
                #${ui_id}-modal .buttons {
                    text-align: right;    
                    margin-top: 1em;           
                }
                #${ui_id}-modal .buttons > button {
                    padding: .5em 1em;
                    margin: 0 .5em;
                }
                #${ui_id}-modal .buttons > button:first-child {
                    margin-left: 0;
                }
                #${ui_id}-modal .buttons > button:last-child {
                    margin-right: 0;
                }
            </style>
            <div id="${ui_id}-backdrop"></div>
            <div id="${ui_id}-modal">
                <p><strong>🧲 Add this magnet link?</strong></p>
                <p style="word-break: break-all;">${magnetLink}</p>
                <div class="reveal-link" id="toggle-settings">
                    ▶ Transmission Server ${hasMissing(config) ? '<span class="warn">⚠️</span>' : ''}
                </div>
                <div class="reveal-content" id="settings-panel">
                    <label class="transmission-label"><input type="checkbox" id="ui-ssl" ${config.ssl ? 'checked' : ''}/><span>Use SSL</span></label>
                    <label class="transmission-label"><span>Host</span><input id="ui-host" value="${config.host || ''}"/></label>
                    <label class="transmission-label"><span>Port</span><input id="ui-port" type="number" value="${config.port || 9091}"/></label>
                    <label class="transmission-label"><span>Username</span><input id="ui-user" value="${config.username || ''}"/></label>
                    <label class="transmission-label"><span>Password</span><input id="ui-pass" type="password" value="${config.password || ''}"/></label>
                    <label class="transmission-label"><span>Download directory (local to the host)</span><input id="ui-dir" value="${config.download_dir || ''}"/></label>
                    <button id="ui-save">Save</button>
                    <button id="ui-load">Load</button>
                </div>
                <div class="buttons">
                    <button id="ui-ok">Add Link</button>
                    <button id="ui-cancel">No</button>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        const backdrop = document.getElementById(`${ui_id}-backdrop`);
        const toggle = document.getElementById('toggle-settings');
        const panel = document.getElementById('settings-panel');

        toggle.addEventListener('click' , () => {
            panel.classList.toggle('open');
            toggle.innerHTML = panel.classList.contains('open')
                ? '▼ Transmission server'
                : `▶ Transmission server ${hasMissing(config) ? '<span class="warn">(!)</span>' : ''}`;
        });

        document.getElementById('ui-ok').addEventListener('click' , () => {
            cleanup();
            resolve(true);
        });
        document.getElementById('ui-save').addEventListener('click' , async () => {
            const updatedConfig = {
                ssl : document.getElementById('ui-ssl').checked ,
                host : document.getElementById('ui-host').value ,
                port : Number(document.getElementById('ui-port').value) ,
                username : document.getElementById('ui-user').value ,
                password : document.getElementById('ui-pass').value ,
                download_dir : document.getElementById('ui-dir').value ,
            };
            await onSave?.(updatedConfig);
        });
        document.getElementById('ui-load').addEventListener('click' , async () => {
            const loadedConfig = await onLoad?.();
            // loadedConfig is {host, port, ssl, username,password,download_dir}
            document.getElementById('ui-ssl').checked = !! loadedConfig.ssl;
            document.getElementById('ui-host').value = loadedConfig.host || '';
            document.getElementById('ui-port').value = loadedConfig.port || 9091;
            document.getElementById('ui-user').value = loadedConfig.username || '';
            document.getElementById('ui-pass').value = loadedConfig.password || '';
            document.getElementById('ui-dir').value = loadedConfig.download_dir || '';
        });

        document.getElementById('ui-cancel').addEventListener('click' , () => {
            cleanup();
            resolve(false);
        });

        function cleanup() {
            container.remove();
        }

        function hasMissing(conf) {
            return ! conf.host || ! conf.username || ! conf.password;
        }
    });
}


module.exports = {
    confirmMagnetAdd
};
