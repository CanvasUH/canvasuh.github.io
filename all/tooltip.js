// ==UserScript==
// @name         Tooltip
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Tooltip for ord som er på dette formatet [ord som skal forklares](forklaring)
// @author       Erlend Thune (erlend.thune@udir.no)
// @match        http://localhost/courses/*
// @match        https://*.instructure.com/courses/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    //Regular expression som henter ut [ord](forklaring)
    var re = /\[(.*?)\]\((.*?)\)/g;

    onElementRendered("#content .user_content.enhanced,#content .show-content.enhanced", function($content) {
        $content.html($content.html().replace(re, '<span class="tooltip">$1<span class="tooltiptext">$2</span></span>'));
    });

    GM_addStyle(".tooltip {position: relative;display: inline-block;border-bottom: 1px dotted black;}");
    GM_addStyle(".tooltip .tooltiptext {visibility: hidden;width: 320px;background-color: white;color: #black;text-align: center;border-radius: 6px;padding: 5px 0;/* Position the tooltip */position: absolute;z-index: 1;}");
    GM_addStyle(".tooltip:hover .tooltiptext {visibility: visible;}");


    function onElementRendered(selector, cb, _attempts) {
        var el = $(selector);
        _attempts = ++_attempts || 1;
        if (el.length) return cb(el);
        if (_attempts >= 60) return;

        setTimeout(function() {
            onElementRendered(selector, cb, _attempts);
        }, 200);
    }

    //https://stackoverflow.com/questions/23683439/gm-addstyle-equivalent-in-tampermonkey
    function GM_addStyle(css) {
        const style = document.getElementById("GM_addStyleBy8626") || (function() {
            const style = document.createElement('style');
            style.type = 'text/css';
            style.id = "GM_addStyleBy8626";
            document.head.appendChild(style);
            return style;
        })();
        const sheet = style.sheet;
        sheet.insertRule(css, (sheet.rules || sheet.cssRules || []).length);
    }
})();