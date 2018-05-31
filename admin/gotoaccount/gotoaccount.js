// ==UserScript==
// @name         gotoaccount
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Add jump to subaccount-button in settingspage
// @author       Tore
// @match        https://*.instructure.com/courses/*/settings
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
        $.getJSON('/api/v1/courses/'+ENV.COURSE_ID,function (data) {
            $("#right-side table.summary").before("<a class='Button Button--link Button--link--has-divider Button--course-settings' href='/accounts/"+data.account_id+"'><i class='icon-replied' />Jump to account</a>");
        });
})();
