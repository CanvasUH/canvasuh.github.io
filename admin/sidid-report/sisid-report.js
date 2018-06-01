// ==UserScript==
// @name         SISID-report
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Generate a report about users without sisid-code (button in right coloumn)
// @author       Tore
// @match        https://*.instructure.com/accounts/1/users
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    //Settings for what you want to find:
    var sisid_should_be_equal_to_userid = true;
    var sisid_should_include_this_string = '@uio.no'; //use an empty string if you don't have any required string
    //write the regexp as /^/ to not use it
    var sisid_matching_regexp1 = /tore/i;
    var sisid_matching_regexp2 = /^/;
    var sisid_matching_regexp3 = /^/;
    //End of settings
    var total_pages;
    var paginationlength;
    var short_users_without_sis = "";
    var instructure_users_without_sis = "";
    var other_users_without_sis = "";
    var sisid_different_from_userid = "";
    var sisid_lacking_required_string = "";
    var sisid_with_match_regexp1 = "";
    var sisid_with_match_regexp2 = "";
    var sisid_with_match_regexp3 = "";

    var pages_read = 0;
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
           for (var i=1;i<=total_pages;i++){
               readpage (i);
           }
        };
        request.send();
    });

    function readpage (pagenum){
        $.getJSON( "https://uio.instructure.com/api/v1/accounts/1/users?page="+pagenum+"&per_page="+paginationlength, function( data ) {
            pages_read += 1;
            contentarea.text('Read '+pages_read+' of '+total_pages+' pages.');
            for (var i=0;i<data.length;i++){
                if (data[i].sis_user_id == null){
                    if (data[i].login_id.indexOf('@') == -1){
                        short_users_without_sis += data[i].login_id + ', ';
                    }else if (data[i].login_id.indexOf('@instructure') != -1){
                        instructure_users_without_sis += data[i].login_id + ', ';
                    }else{
                        other_users_without_sis += data[i].login_id + ', ';
                    }
                }else{
                    if (sisid_should_be_equal_to_userid && data[i].sis_user_id != data[i].login_id){
                        sisid_different_from_userid += data[i].login_id + ' (' + data[i].sis_user_id +'), ';
                    }
                    if (sisid_should_include_this_string.length && data[i].sis_user_id.indexOf(sisid_should_include_this_string) == -1){
                        sisid_lacking_required_string += data[i].login_id + ' (' + data[i].sis_user_id +'), ';
                    }
                    if (sisid_matching_regexp1.source != '^' && sisid_matching_regexp1.test(data[i].sis_user_id)){
                        sisid_with_match_regexp1 += data[i].login_id + ' (' + data[i].sis_user_id +'), ';
                    }
                    if (sisid_matching_regexp2.source != '^' && sisid_matching_regexp2.test(data[i].sis_user_id)){
                        sisid_with_match_regexp2 += data[i].login_id + ' (' + data[i].sis_user_id +'), ';
                    }
                    if (sisid_matching_regexp3.source != '^' && sisid_matching_regexp3.test(data[i].sis_user_id)){
                        sisid_with_match_regexp3 += data[i].login_id + ' (' + data[i].sis_user_id +'), ';
                    }

                }
            }
            if (pages_read == total_pages){
                renderResult();
            }
         });
    }
    function renderResult(){
        var contenttext = '<h1>Users without SISID</h1>';
        if (short_users_without_sis.length) contenttext += '<h2>Users without @</h2><p>'+short_users_without_sis+'</p>';
        if (instructure_users_without_sis.length) contenttext += '<h2>Instructure users</h2><p>'+instructure_users_without_sis+'</p>';
        if (other_users_without_sis.length) contenttext += '<h2>Other users</h2><p>'+other_users_without_sis+'</p>';
        if (sisid_different_from_userid.length || sisid_lacking_required_string.length || sisid_with_match_regexp1.length || sisid_with_match_regexp2.length || sisid_with_match_regexp3.length){
            contenttext += '<h1>Users with interesting SISID</h1><p>(users can be listed under multiple headings)</p>';
            if (sisid_different_from_userid.length) contenttext += '<h2>SISID is not equal to USERID</h2><p>'+sisid_different_from_userid+'</p>';
            if (sisid_lacking_required_string.length) contenttext += "<h2>SISID doesn't contain "+sisid_should_include_this_string+'</h2><p>'+sisid_lacking_required_string+'</p>';
            if (sisid_with_match_regexp1.length) contenttext += "<h2>SISID matching "+sisid_matching_regexp1.toString()+'</h2><p>'+sisid_with_match_regexp1+'</p>';
            if (sisid_with_match_regexp2.length) contenttext += "<h2>SISID matching "+sisid_matching_regexp2.toString()+'</h2><p>'+sisid_with_match_regexp2+'</p>';
            if (sisid_with_match_regexp3.length) contenttext += "<h2>SISID matching "+sisid_matching_regexp3.toString()+'</h2><p>'+sisid_with_match_regexp3+'</p>';
        }
        contentarea.html(contenttext);
    }
})();
