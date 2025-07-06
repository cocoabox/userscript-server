# userscript-server

This app combines all your userscripts into one webpacked userscript, and serves it on a server - 
so you can use thje same set of userscripts anywhere (given yhou have access to this server). Other benefits:

- your userscripts can act as mini-packages with their own `package.json`, and can use third party npm packages
- some common functionalities are provided for your convenience in [frontend-utils/](frontend-utils/), for example
  - ```js
    async function ui.msgbox({text:string, title:string, buttons:{button_ident_str:caption}, esc_key:button_ident_str, ...})
    ```
  - ```js
    async function ui.waitForSelector(selector:string , {interval = 100 , timeout = 5000 , all = false})
    ```
    
Hosted userscripts can be accessed via `http://USERSCRIPT_SERVER:8088/lite.user.js` (this has a `@require` clause so just need to refresh the external script when updated).

## Note

By default, it runs on port `:8088` using a hardcoded hostname, in [conf/userscript-server.json5](conf/userscript-server.json5).
If hostname is not defined it will use `require('os').hostname()`. 

To access your userscript, access `http://USERSCRIPT_SERVER:8088/lite.user.js`

## Running 

to enable logging to `/var/log`, type

```bash
$ ./start.sh 
```

to just start the server, type

```bash 
$ node .
```

## Installing as a `systemd` service

1. modify [userscript-server.service.template](userscript-server.service.template) to add/remove prerequesite services.
2. type
   ```bash
   $ bash install-service.sh
   ```


## TODO

- [ ] Create a central file read/save service so that script settings are shared among all my devices
- [ ] Certificate thingy and https (and .mobileconfig install)
