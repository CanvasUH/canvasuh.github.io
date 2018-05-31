// ==UserScript==
// @name         SISID-report
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Generate a report about users without sisid-code (button in right coloumn)
// @author       Tore
// @match        https://*.instructure.com/accounts/1/users
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    var total_pages;
    var paginationlength;
    var users_without_sis = "";
    var contentarea = $('#content');

   $("#right-side-wrapper").append("<div><a id='sisreport' class='Button Button--link Button--link--has-divider Button--course-settings' href='#'><i class='icon-group' />User SISID-report</a></div>");

    $('#sisreport').on('click', function() {
        contentarea.text('');
        var request = new XMLHttpRequest();
        request.open('GET', 'https://uio.instructure.com/api/v1/accounts/1/users?per_page=1000', true);
        request.onload = function(){
           var linkarray = request.getResponseHeader('Link').split(",");
           var lasturl = linkarray[linkarray.length - 1];
           var myRegexp = /page=(\d*)&per_page=(\d*)/;
           var match = myRegexp.exec(lasturl);
           total_pages = parseInt(match[1]);
           paginationlength = parseInt(match[2]);
           readpage (1);
        };
        request.send();
    });

    function readpage (pagenum){
        $.getJSON( "https://uio.instructure.com/api/v1/accounts/1/users?page="+pagenum+"&per_page="+paginationlength, function( data ) {
            contentarea.text('Read '+pagenum+' of '+total_pages+' pages.');
            for (var i=0;i<data.length;i++){
                if (data[i].sis_user_id == null){
                    users_without_sis += data[i].login_id + ', ';
                }
            }

            if (pagenum == total_pages){
                renderResult();
            }else{
                readpage (pagenum+1);
            }
         });
    }
    function renderResult(){
        contentarea.html('<h1>Users without SISID</h1><p>'+users_without_sis+'</p>');
    }
})();
