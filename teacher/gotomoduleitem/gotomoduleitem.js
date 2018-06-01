// ==UserScript==
// @name         gotomoduleitem
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Add jump to module-button in pages, discussions etc.
// @author       Erlend
// @match        https://*.instructure.com/courses/*/*
// @grant        none
// ==/UserScript==

//For module item in module: https://usn.instructure.com/courses/12688/modules#context_module_item_24437
//Need to get the module id and the course id.

(function() {
    'use strict';
    var params = getAllUrlParams(window.location.href);
    var moduleItemId = params.module_item_id;
    var targetHref = "/courses/" + ENV.COURSE_ID + "/modules#context_module_item_" + moduleItemId;
    addButton(targetHref);
})();

function getHeaderBarJson()
{
    var headerBarPosition = "after";

    //Content page
    var headerBar = $("#wiki_page_show > div.header-bar-outer-container > div > div.header-bar.flex-container > div.header-bar-right.header-right-flex");

    //Quiz
    if ( !headerBar.length )
    {
        headerBar = $("#quiz_show > div.header-bar > div");
    }
    //Assignment
    if ( !headerBar.length )
    {
        headerBar = $("#assignment_show > div.assignment-title > div.assignment-buttons");
    }
    //Discussion
    if ( !headerBar.length )
    {
        headerBar = $("#discussion-managebar > div > div > div.pull-right");
    }
    //File
    if ( !headerBar.length )
    {
        headerBar = $("#content");
        headerBarPosition = "before";
    }
    var headerBarJson = { "headerBar":headerBar, "position":headerBarPosition }

    return headerBarJson;
}

function addButton(targetHref)
{
    var headerBarJson = getHeaderBarJson();
    if ( headerBarJson.headerBar.length )
    {
        var html = "<a class='btn' href='" + targetHref + "'>Gå til modul</a>";

        if(headerBarJson.position == "after")
        {
            headerBarJson.headerBar.append(html);
        }
        else
        {
            headerBarJson.headerBar.before(html);
        }
    }
    else
    {
        setTimeout(function(){
            addButton(targetHref);
        }, 500);
    }
}

function getAllUrlParams(url) {

  // get query string from url (optional) or window
  var queryString = url ? url.split('?')[1] : window.location.search.slice(1);

  // we'll store the parameters here
  var obj = {};

  // if query string exists
  if (queryString) {

    // stuff after # is not part of query string, so get rid of it
    queryString = queryString.split('#')[0];

    // split our query string into its component parts
    var arr = queryString.split('&');

    for (var i=0; i<arr.length; i++) {
      // separate the keys and the values
      var a = arr[i].split('=');

      // in case params look like: list[]=thing1&list[]=thing2
      var paramNum = undefined;
      var paramName = a[0].replace(/\[\d*\]/, function(v) {
        paramNum = v.slice(1,-1);
        return '';
      });

      // set parameter value (use 'true' if empty)
      var paramValue = typeof(a[1])==='undefined' ? true : a[1];


      // if parameter name already exists
      if (obj[paramName]) {
        // convert value to array (if still string)
        if (typeof obj[paramName] === 'string') {
          obj[paramName] = [obj[paramName]];
        }
        // if no array index number specified...
        if (typeof paramNum === 'undefined') {
          // put the value on the end of the array
          obj[paramName].push(paramValue);
        }
        // if array index number specified...
        else {
          // put the value at that index number
          obj[paramName][paramNum] = paramValue;
        }
      }
      // if param name doesn't exist yet, set it
      else {
        obj[paramName] = paramValue;
      }
    }
  }

  return obj;
}
