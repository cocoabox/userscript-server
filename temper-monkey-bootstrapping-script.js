// ==UserScript==
// @name         My user script
// @namespace    http://{{hostname}}:{{port}}/
// @version      0.0.1
// @description  Runs userscripts served on userscript server
// @author       me
// @match        *://*/*
// @grant        GM_addElement
// @grant        GM_addStyle
// @grant        GM_download
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @grant        GM_info
// @grant        GM_log
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setClipboard
// @grant        GM_getTab
// @grant        GM_saveTab
// @grant        GM_getTabs
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_setValues
// @grant        GM_getValues
// @grant        GM_deleteValues
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_webRequest
// @grant        GM_cookie
// @grant        unsafeWindow
// @run-at       document-idle
// @sandbox      JavaScript
// @connect      self
// @connect      *
// @require      http://{{hostname}}:{{port}}/us.js
// ==/UserScript==
