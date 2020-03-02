// ==UserScript==
// @name         gotoaccount
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Add jump to subaccount-button in settingspage
// @author       Tore
// @match        https://*.instructure.com/courses/*/settings
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    async function CanvasGet (last_part_of_url){
        //Does a Canvas API call and returns a JS-object.
        let response = await fetch(location.origin+'/api/v1/'+last_part_of_url);
        let data = await response.text();
        return JSON.parse(data.substring(9));
    }
    CanvasGet('courses/'+ENV.COURSE_ID).then((data)=>{
        let newbutton = document.createElement('a');
        document.querySelector("#right-side table.summary").before(newbutton);
        newbutton.outerHTML = "<a class='Button Button--link Button--link--has-divider Button--course-settings' href='/accounts/"+data.account_id+"'><i class='icon-replied' /> Jump to account</a>";
    });
})();
