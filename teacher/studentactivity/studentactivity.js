// ==UserScript==
// @name         Student activity report
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Generate a report about the users activity in the course
// @author       Erlend
// @match        *://*/courses/*
// @grant        none
// ==/UserScript==

this.etsikt=this.etsikt||{};

this.etsikt.api = function() {
    var _urlToTypeMapping = [];

    _urlToTypeMapping['quizzes'] = 'Quiz';
    _urlToTypeMapping['assignments'] = 'Assignment';
    _urlToTypeMapping['discussion_topics'] = 'Discussion';


    return {
        _ajax: typeof $   !== "undefined" ? $   : {},

        _env:  typeof ENV !== "undefined" ? ENV : {},

        _location: typeof document !== "undefined" ? document.location : {search:"", href:""},

        _uriPrefix: "/api/v1",

        _defaultError: function (event, jqxhr, settings, thrownError) {
            console.log(event, jqxhr, settings, thrownError);
        },

        _sendRequest: function(method, options) {
            var error    = options.error || this._defaultError;
            var uri      = this._uriPrefix + options.uri;
            var params   = options.params || {};
            var callback = options.callback;
            method(uri, params, callback).fail(error);
        },

        _get: function(options) {
            //this._sendRequest(this._ajax.get, options);

            /*  Fix for returning student_id in response.
            *   Needed for powerfunction _printStudentProgressForSection to list progress for correct student.
            */

            var uri      = this._uriPrefix + options.uri;
            var params   = options.params || {};
            var callback = options.callback;

            $.ajax({
                url: uri,
                type: 'GET',
                data: params,
                success: function(response, status, xhr) {
                    if("student_id" in params) {
                        response = response.map(function(el){el.student_id = params.student_id; return el});
                    }
                    if(uri.indexOf("/groups/") !== -1 && uri.indexOf("/users") !== -1) {
                      var groupId = uri.split("/groups/");
                      groupId = groupId[1].split("/users");
                      groupId = parseInt(groupId[0]);
                      response = response.map(function(el){el.group_id = groupId; return el});
                    }
                    callback(response, xhr);
                },
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    console.log("Error during GET");
                }
            });

        },
        getCurrentCourseId: function() {
            var currentUrl = "" + this._location.pathname;
            var matches = currentUrl.match(/\/courses\/(\d+)/);
            if (matches != null) {
                return parseInt(matches[1], 10);
            } else if (this._env.group) {
                // Group pages does not contain course id in URL, but is available via JavaScript variable
                return this._env.group.context_id;
            } else if ($("#discussion_container").size() > 0) {
                // Group subpages contains course id only in a link
                //#discussion_topic > div.entry-content > header > div > div.pull-left > span > a
                var tmp = $("#discussion_topic div.entry-content header div div.pull-left span a").attr("href").split("/");
                if (tmp.length == 3) {
                    return parseInt(tmp[2], 10);
                }
            }

            return null;
        },
        getCourse: function(courseId, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/courses/" + courseId,
                "params":   {  }
            });
        },
        getEnrollmentsForCourse: function(courseId, params, callback) {
            this._get({
                "callback": callback,
                "uri":      "/courses/" + courseId + "/enrollments",
                "params":   params
            });
        },

    };
}();

if (typeof module !== "undefined" && module !== null) {
    module.exports = this.etsikt.api;
}

(function() {
    'use strict';
    var bCancel = false;
    var params = { per_page: 9999 };

    var error = function(error) {
        console.error("error calling api", error);
    };

    var allEnrollments = [];

    function stanDeviate(arr){
        var oStdDev = {mean: 0, stdDev: 0, min: 0, max:0};
        var i,j,mean = 0,total = 0, diffSqredArr = [];
        for(i=0;i<arr.length;i+=1){
            oStdDev.max = Math.max(oStdDev.max, arr[i].total_activity_time);
            oStdDev.min = Math.min(oStdDev.min, arr[i].total_activity_time);
            total+=arr[i].total_activity_time;
        }
        mean = total/arr.length;
        oStdDev.mean = mean;
        for(j=0;j<arr.length;j+=1){
            diffSqredArr.push(Math.pow((arr[j].total_activity_time-mean),2));
        }
        oStdDev.stdDev = (Math.sqrt(diffSqredArr.reduce(function(firstEl, nextEl){
            return firstEl + nextEl;
        })/arr.length));
        return oStdDev;
    };

    function median(arr){
        var oMedian = {lowerQuartile: 0, median: 0, upperQuartile: 0};
        if(arr.length ===0) return oMedian;

        arr.sort(function(a,b){
            return a.total_activity_time-b.total_activity_time;
        });

        oMedian.lowerQuartile = arr[Math.floor(arr.length / 4)].total_activity_time;
        oMedian.upperQuartile = arr[Math.floor(arr.length / 4) * 3].total_activity_time;

        var half = Math.floor(arr.length / 2);

        if (arr.length % 2) {
            oMedian.median = arr[half].total_activity_time;
        } else {
            oMedian.median = (arr[half - 1].total_activity_time + arr[half].total_activity_time) / 2.0;
        }

        return oMedian;
    }

    function getUniqueUserIdArray(arr)
    {
        var uniqueArr = [];
        arr.sort(function(a,b){
            return a.user_id-b.user_id;
        });
        var prevUserId = -1;
        for(var i=0;i<arr.length;i+=1){
            if(arr[i].user_id != prevUserId)
            {
                uniqueArr.push(arr[i]);
            }
            prevUserId = arr[i].user_id;
        }
        return uniqueArr;
    }
    function toHHMMSS(s) {
        var sec_num = parseInt(s, 10); // don't forget the second param
        var hours   = Math.floor(sec_num / 3600);
        var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
        var seconds = sec_num - (hours * 3600) - (minutes * 60);

        if (hours   < 10) {hours   = "0"+hours;}
        if (minutes < 10) {minutes = "0"+minutes;}
        if (seconds < 10) {seconds = "0"+seconds;}
        return hours+':'+minutes+':'+seconds;
    }
    function presentResult()
    {
        var contenttext = "";

        var uniqueArr = getUniqueUserIdArray(allEnrollments);

        var oMedian = median(uniqueArr);

        var oStdDev = stanDeviate(uniqueArr);

        contenttext = "Number of unique students: " + uniqueArr.length;
        contenttext += "<h3>Total activity time</h3>";

        var s1 = "Mean";
        var s2 = "StdDev";
        var s3 = "Median";
        var s4 = "Lower Quartile";
        var s5 = "Upper Quartile";
        var s6 = "Min";
        var s7 = "Max";

        //HTML summary
        contenttext += "<table class='table'><tbody>";
        contenttext += "<tr><td>" + s1 + "</td><td>" + toHHMMSS(Math.round(oStdDev.mean)) + "</td></tr>";
        contenttext += "<tr><td>" + s2 + "</td><td>" + toHHMMSS(Math.round(oStdDev.stdDev)) + "</td></tr>";
        contenttext += "<tr><td>" + s3 + "</td><td>" + toHHMMSS(Math.round(oMedian.median)) + "</td></tr>";;
        contenttext += "<tr><td>" + s4 + "</td><td>" + toHHMMSS(oMedian.lowerQuartile) + "</td></tr>";
        contenttext += "<tr><td>" + s5 + "</td><td>" + toHHMMSS(oMedian.upperQuartile) + "</td></tr>";
        contenttext += "<tr><td>" + s6 + "</td><td>" + toHHMMSS(oStdDev.min) + "</td></tr>";;
        contenttext += "<tr><td>" + s7 + "</td><td>" + toHHMMSS(oStdDev.max) + "</td></tr>";;
        contenttext += "</tbody></table>";

        contenttext += "</tbody></table>";
        $("#resultarea").append(contenttext);
    }

    function getNextPageNumber(xhr)
    {
        var result = null;
        var last_page = null;
        var next_page = null;
        var per_page = null;

        var linkarray = xhr.getResponseHeader('Link').split(",");
        for (var i = 0; i < linkarray.length; i++) {
            var link = linkarray[i];
            var relRegExp=/rel="(.*)"/;
            var pageRegexp = /page=(\d*)&per_page=(\d*)/;
            var relmatch = relRegExp.exec(link);
            var pagematch = pageRegexp.exec(link);
            if(relmatch && pagematch)
            {
                if(relmatch[1] == "next")
                {
                    next_page = parseInt(pagematch[1]);
                    per_page = parseInt(pagematch[2]);
                }
                else if(relmatch[1] == "last")
                {
                    last_page = parseInt(pagematch[1]);
                }
            }
        }
        result = {next_page: next_page, per_page: per_page, last_page: last_page};

        return result;
    }
    function updateOverallProgress(s)
    {
        $("#etsiktOverallProgress").html(s);
    }
    function updatePageProgress(s)
    {
        $("#etsiktPageProgress").html(s);
    }
    function updateStudentProgress(s)
    {
        $("#etsiktStudentProgress").html(s);
    }

    function processStudents(courseId, pagenum, perpage){
        if(bCancel)
        {
            reportCancelled();
            return;
        }
        var localParams = {
            page: pagenum,
            per_page: perpage,
            type: "StudentEnrollment",
            state: "active"
        };
        updateOverallProgress("Henter studenter...");

        etsikt.api.getEnrollmentsForCourse(courseId, localParams, function(students, xhr) {
            if(bCancel)
            {
                reportCancelled();
                return;
            }
            var next = getNextPageNumber(xhr);
            updatePageProgress("Side " + pagenum + " av " + next.last_page);
            allEnrollments.push.apply(allEnrollments, students);

            if(next && next.next_page)
            {
                processStudents(courseId, next.next_page, next.per_page);
            }
            else
            {
                presentResult();
            }
        }) //End getenrollmentsforcourse
    } //end function

    function reportCancelled()
    {
        updateOverallProgress("");
        updatePageProgress("");
        updateStudentProgress("")
        $("#etsiktReportButtonDiv").html("Rapport avbrutt.");
    }

    ////////
    //MAIN
    ////////
    //Her lager vi knappen i Canvas!
    $("#course_show_secondary > div.course-options").append('<a id="etsiktstudentactivitybutton" class="btn button-sidebar-wide" href="#"><i class="icon-announcement"></i>Student activity</a>');

    //Når man trykker på knappen så kjører koden nedenfor.
    $('#etsiktstudentactivitybutton').on('click', function() {
        bCancel = false;
        var contentarea = $('#content');
        contentarea.html('<h1>Student activity</h1>\
<div id="etsiktOverallProgress"></div><div id="etsiktPageProgress">\
</div><div id="etsiktStudentActivity"></div>\
<div id="resultarea"></div>\
<div id="etsiktReportButtonDiv"><a id="etsiktReportButtonId" class="btn" href="#">Avbryt</a></div>');
        $('#etsiktReportButtonId').on('click', function() {
            $("#etsiktReportButtonDiv").html("Avbryter rapport...");
            bCancel = true;
        });
        var page = 1;
        var per_page = 50;
        allEnrollments = [];

        var courseId = etsikt.api.getCurrentCourseId();
        mmooc.api.getCourse(courseId, function(course) {
            $("#resultarea").append("<h2>" + course.name + "</h2>");
            processStudents(courseId,page, per_page);
        });
    });
})();





