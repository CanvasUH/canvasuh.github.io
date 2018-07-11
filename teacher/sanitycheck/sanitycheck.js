// ==UserScript==
// @name         Course sanity check
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Generate a report about how many users have done how much in the course.
// @author       erlend.thune@udir.no
// @match        *://*/courses/*/settings
// @grant        none
// ==/UserScript==

this.mmooc=this.mmooc||{};

this.mmooc.api = function() {
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

        _post: function(options) {
            this._sendRequest(this._ajax.post, options);
        },

        _put: function(options) {
            var uri      = this._uriPrefix + options.uri;
            var params   = options.params || {};
            var callback = options.callback;

            $.ajax({
                url: uri,
                type: 'PUT',
                data: params,
                success: function(response) {
                    callback(response);
                },
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    console.log("Error during PUT");
                }
            });
        },

        /*  FIXME for listModulesForCourse()
         *  This function loads data in a blocking manner no matter how many items and modules are present.
         *  This could potentially pose problems in the future, as page load time increases rapidly when
         *  the number of requests are numerous. This function should be updated to use non-blocking loading
         *  if Canvas is not updated to allow for better data loading through their API.
         */
        listModulesForCourse: function(callback, error, cid)
        {
            var href= "/api/v1/courses/" + cid + "/modules?per_page=100";
            $.getJSON(href, function(modules) {
                    var noOfModules = modules.length;
                    var asyncsDone = 0;
                    for (var i = 0; i < noOfModules; i++) {
                        var m = modules[i];
                        var href= "/api/v1/courses/" + cid + "/modules/" + m.id + "/items?per_page=100";
                        $.getJSON(
                            href,
                            (function(j) {
                                return function(items) {
                                    modules[j].items = items;
                                    asyncsDone++;

                                    if(asyncsDone === noOfModules) {
                                        callback(modules);
                                    }
                                };
                            }(i)) // calling the function with the current value
                        );
                    };
                }
            );
        },

        getCurrentModuleItemId : function() {
            var moduleId;
            var relativeUrl = location.pathname;
            var patt = /\/courses\/\d+\/modules\/items\/\d+$/;
            var isRelativeUrlMatching = patt.test(relativeUrl);
            if (isRelativeUrlMatching) {
                var n = relativeUrl.lastIndexOf('/');
                moduleId = relativeUrl.substring(n + 1);
            } else {
                var paramName = "module_item_id";
                var q = "" + this._location.search;
                if (typeof q === "undefined" || q.indexOf(paramName) == -1) {
                    return null;
                }

                moduleId = q.substring(q.indexOf(paramName) + paramName.length + 1, q.length);
                if (moduleId.indexOf("&") != -1) {
                    moduleId = moduleId.substring(0, moduleId.indexOf("&"));
                }
            }

            return parseInt(moduleId, 10);
        },

        getCurrentTypeAndContentId: function() {
            var regexp = /\/courses\/\d+\/\w+\/\d+/;

            if (regexp.test("" + this._location.pathname)) {
                var tmp = this._location.pathname.split("/");
                if (tmp.length >= 5) {
                    var type = _urlToTypeMapping[tmp[3]];
                    var contentId = parseInt(tmp[4], 10);
                    return { contentId: contentId, type: type};
                }
            }
            return null;
        },

        getSelfRegisterCourse: function(callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/search/all_courses",
                "params":   { "search": "SELFREGISTER" }
            });
        },


        getAllCourses: function(callback, error) {
            this._get({
                "callback": function(courses) {
                    var filteredCourses = courses.filter(mmooc.util.filterSearchAllCourse);
                    callback(filteredCourses);
                },
                "error":    error,
                "uri":      "/search/all_courses",
                "params":   { per_page: 999 }
            });
        },

        getEnrolledCourses: function(callback, error) {
            this._get({
                "callback": function(courses) {
                    var filteredCourses = courses.filter(mmooc.util.filterCourse);
                    callback(filteredCourses);
                },
                "error":    error,
                "uri":      "/courses",
                "params":   { "include": ["syllabus_body", "course_progress"], "per_page": "100" }
            });
        },

/* 12032018 Erlend Thune: Refactor this out by adding course progress parameter to getEnrolledCourses.
        getEnrolledCoursesProgress: function(callback, error) {
            this._get({
                "callback": function(courses) {
                    var filteredCourses = courses.filter(mmooc.util.filterCourse);
                    callback(filteredCourses);
                },
                "error":    error,
                "uri":      "/courses",
                "params":   { "include": ["course_progress"], "per_page": "100" }
            });
        },
*/
        /* FIXME Regarding include items: This parameter suggests that
         * Canvas return module items directly in the Module object
         * JSON, to avoid having to make separate API requests for
         * each module when enumerating modules and items. Canvas is
         * free to omit 'items' for any particular module if it deems
         * them too numerous to return inline. Callers must be
         * prepared to use the List Module Items API if items are not
         * returned.
         */
        getModulesForCurrentCourse: function(callback, error) {
            var courseId = this.getCurrentCourseId();
            this.listModulesForCourse(callback, error, courseId);
        },

        getModulesForCourseId: function(callback, error, courseId) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/courses/" + courseId + "/modules",
                "params":   { per_page: 999 }
            });
        },

        getItemsForModuleId: function(callback, error, courseId, moduleId, params) {
            this._get({
                "callback": callback,
                "error": error,
                "uri": "/courses/" + courseId + "/modules/" + moduleId + "/items",
                "params": params
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

        getCurrentGroupId: function() {
            var currentUrl = "" + this._location.pathname;
            var matches = currentUrl.match(/\/groups\/(\d+)/);
            if (matches != null) {
                return parseInt(matches[1], 10);
            }
            return null;
        },

        getGroup: function(groupId, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/groups/" + groupId,
                "params":   {}
            });
        },

        getGroupMembers: function(groupId, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/groups/" + groupId + "/users",
                "params":   {"include": ["avatar_url"], "per_page": 999 }
            });
        },


		//////
        getCurrentModuleForItemOrTypeAndContentId: function(moduleItemId, typeAndContentId, callback, error) {
            this.getModulesForCurrentCourse(function(modules) {
                for (var i = 0; i < modules.length; i++) {
                    var module = modules[i];
                    var items = module.items;
                    for (var j = 0; j < items.length; j++) {
                        var item = items[j];
                        //Need to check type and id for quiz and assignment items
                        var isCurrentModuleItem = item.id == moduleItemId || (typeAndContentId != null && typeAndContentId.contentId == item.content_id && typeAndContentId.type == item.type);
                        if (isCurrentModuleItem) {
                            item.isCurrent = true;
                            callback(module);
                            return;
                        }
                    }
                }

            }, error);
        },

		//To find which module a group discussion belongs to, we need to
		//1. Get the group discussion
		//2. Get the group category
		//3. Get the root discussion
		//4. Get the module
	    //A group discussion has a location like this:
	    //https://beta.matematikk.mooc.no/groups/361/discussion_topics/79006
		getCurrentModuleItemForGroupDiscussion: function(callback, error) {
            var regexp = /\/groups\/\d+\/discussion_topics\/\d+/;
			var tmp;
		    var groupId;
		    var groupTopicId;

			//Extract groupId and groupTopicId
            if (regexp.test("" + this._location.pathname)) {
                tmp = this._location.pathname.split("/");
                if (tmp.length >= 5) {
                    groupTopicId = tmp[4];
		            groupId = tmp[2];
                }
            }

            if(groupTopicId == null)
            {
            	return;
            }

            //https://beta.matematikk.mooc.no/api/v1/groups/361/discussion_topics/79006
		    //Need to keep track of this to access it inside the inline functions below.
			var _this = this;
			this.getSpecificGroupDiscussionTopic(groupId, groupTopicId, function(groupDiscussion) {
				_this.getUserGroups(function(groups) {
					for (var i = 0; i < groups.length; i++) {
						if(groups[i].id == groupId)
						{
							var moduleItemId = null;
		        			var currentTypeAndContentId = { contentId: groupDiscussion.root_topic_id, type: "Discussion"};
		        			_this.getCurrentModuleForItemOrTypeAndContentId(moduleItemId, currentTypeAndContentId, callback, error);
			        		break; //We found the correct group, no need to check the rest.
			        	}
		        	} //end for all the groups
                }); //getUserGroups
            }); //getSpecificGroupDiscussionTopic
		},

        getCurrentModule: function(callback, error) {
            var currentModuleItemId = this.getCurrentModuleItemId();
            var currentTypeAndContentId = null;
            var bFound = true;
            //Quizzes and assignments does not have module item id in URL
            if (currentModuleItemId == null) {
                currentTypeAndContentId = this.getCurrentTypeAndContentId();

                //If we haven't found what we want by now, it must be a group discussion
                if (currentTypeAndContentId == null) {
					bFound = false;
					this.getCurrentModuleItemForGroupDiscussion(callback, error);
                }
            }

            if(bFound)
            {
				this.getCurrentModuleForItemOrTypeAndContentId(currentModuleItemId, currentTypeAndContentId, callback, error)
            }
        },

        getLocale : function() {
            return this._env.LOCALE;
        },

        getRoles : function() {
            return this._env.current_user_roles;
        },

        getUser : function() {
            return this._env.current_user;
        },

        getUserProfile : function(callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/users/self/profile",
                "params":   { }
            });
        },

        getActivityStreamForUser: function(callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/users/self/activity_stream",
                "params":   { }
            });
        },

        currentPageIsAnnouncement: function() {
            return ($("#section-tabs").find("a.announcements.active").size() == 1);
        },

        currentPageIsModuleItem: function() {
            if (this.getCurrentModuleItemId() != null || this.getCurrentTypeAndContentId() != null) {
                return true;
            } else {
                return false;
            }
        },

        getUnreadMessageSize: function() {

            var $oldUIUnreadMessages = $('.unread-messages-count');
            var $newUIUnreadMessages = $('#global_nav_conversations_link .menu-item__badge');

            if ($oldUIUnreadMessages.length) {
                return parseInt($oldUIUnreadMessages.text()); //returns number of unread messages for old UI.
            } else if ($newUIUnreadMessages.length) {
                return parseInt($newUIUnreadMessages.text()); //returns number of unread messages for new UI.
            } else {
                return 0;
            }
        },

        getAccounts: function(callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/accounts",
                "params":   { }
            });

        },

        getUsersForAccount: function(account, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/accounts/" + account + "/users",
                "params":   { }
            });
        },

        getCoursesForAccount: function(account, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/accounts/" + account + "/courses",
                "params":   { per_page: 999 }
            });
        },

        getCoursesForUser: function(callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/courses",
                "params":   { per_page: 999 }
            });
        },

        getGroupCategoriesForAccount: function(account, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/accounts/" + account + "/group_categories",
                "params":   { }
            });
        },

        getGroupCategoriesForCourse: function(course, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/courses/" + course + "/group_categories",
                "params":   { per_page: 999 }
            });
        },

        // Recursively fetch all groups by following the next links
        // found in the Links response header:
        // https://canvas.instructure.com/doc/api/file.pagination.html
        _getGroupsForAccountHelper: function(accumulatedGroups, callback, error) {
            var that = this;
            return function(groups, status, xhr) {
                Array.prototype.push.apply(accumulatedGroups, groups);
                var next = xhr.getResponseHeader('Link').split(',').find(function (e) {
                    return e.match("rel=\"next\"");
                });
                if (next === undefined) {
                    callback(accumulatedGroups);
                }
                else {
                    var fullURI = next.match("<([^>]+)>")[1];
                    that._get({
                        "callback": that._getGroupsForAccountHelper(accumulatedGroups, callback, error),
                        "error":    error,
                        "uri":      fullURI.split("api/v1")[1],
                        "params":   { }
                    });
                }
            };
        },

        getGroupsForAccount: function(account, callback, error) {
            this._get({
                "callback": this._getGroupsForAccountHelper([], callback, error),
                "error":    error,
                "uri":      "/accounts/" + account + "/groups",
                "params":   { per_page: 999 }
            });
        },

		// /api/v1/group_categories/:group_category_id
        getGroupCategory: function(categoryID, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/group_categories/" + categoryID,
                "params":   { }
            });
        },

        // /api/v1/group_categories/:group_category_id/groups
        getGroupsInCategory: function(categoryID, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/group_categories/" + categoryID + "/groups",
                "params":   { per_page: 999 }
            });
        },

        // /api/v1/courses/:course_id/groups
        getGroupsInCourse: function(courseID, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/courses/" + courseID + "/groups",
                "params":   { per_page: 999 }
            });
        },

        // /api/v1/group_categories/users/self/groups
        getUserGroups: function(callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/users/self/groups",
                "params":   { per_page: 999 }
            });
        },

        // /api/v1/courses/:course_id/sections
        getSectionsForCourse: function(courseID, params, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/courses/" + courseID + "/sections",
                "params":   params
            });
        },

        // /api/v1/sections/%d/enrollments?type[]=StudentEnrollment", sectionid)
        getEnrolledStudentsForCourse: function(sectionID, params, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/sections/" + sectionID + "/enrollments?type[]=StudentEnrollment",
                "params":   params
            });
        },
        ///api/v1/courses/%d/modules/%d/items?student_id=%d
        getCourseModuleItemsForStudent: function(courseID, moduleID, studentID, params, error, callback) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/courses/" + courseID + "/modules/" + moduleID + "/items?student_id=" + studentID,
                "params":   params
            });
        },

        // /api/v1/sections/:section_id
        getSingleSection: function(sectionID, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/sections/" + sectionID,
                "params":   {}
            });
        },

        // /api/v1/courses/54/assignments/369
        getSingleAssignment : function(courseId, assignmentId, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/courses/" + courseId + "/assignments/" + assignmentId,
                // "params":   {"include": ["submission", "assignment_visibility", "overrides", "observed_users"]}
                "params":   {}
            });
        },

        // /api/v1/courses/:course_id/assignments
        getAssignmentsForCourse : function(courseId, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/courses/" + courseId + "/assignments",
                "params":   { per_page: 999 }
            });
        },
        getPagesForCourse: function(courseId, callback) {
            this._get({
                "callback": callback,
                "uri":      "/courses/" + courseId + "/pages",
                "params":   { per_page: 999 }
            });
        },

        getDiscussionTopicsForCourse: function(courseId, callback) {
            this._get({
                "callback": callback,
                "uri":      "/courses/" + courseId + "/discussion_topics",
                "params":   { per_page: 999 }
            });
        },
        getQuizzesForCourse: function(courseId, callback) {
            this._get({
                "callback": callback,
                "uri":      "/courses/" + courseId + "/quizzes",
                "params":   { per_page: 999 }
            });
        },

        // /api/v1/courses/54/assignments/369/submissions/1725
        getSingleSubmissionForUser : function(courseId, assignmentId, user_id, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/courses/" + courseId + "/assignments/" + assignmentId + "/submissions/" + user_id,
                "params":   {"include": ["submission_history", "submission_comments", "rubric_assessment", "visibility", "course", "user"]}
                // "params":   {"include": ["rubric_assessment", "visibility"]}
            });
        },

        // /api/v1/courses/7/assignments/11/submissions/4/peer_reviews
        // This API displays info about who has the peer review for a specific submissionID which is the id property on the submission object (different from user id)
        getPeerReviewsForSubmissionId : function(courseId, assignmentId, submission_id, callback, error) {
            // Returns only the student's peer reviews if you are a student. Returns all peer reviews if you are a teacher or admin
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/courses/" + courseId + "/assignments/" + assignmentId + "/submissions/" + submission_id + "/peer_reviews",
                // "params":   {"include": ["submission_comments", "user"]}
                "params":   {"include": ["user"]}
            });
        },

        // /api/v1/courses/:course_id/assignments/:assignment_id/peer_reviews
        getPeerReviewsForAssignment : function(courseId, assignmentId, callback, error) {
            this._get({
                "callback": callback,
                "error":    error,
                "uri":      "/courses/" + courseId + "/assignments/" + assignmentId + "/peer_reviews",
                "params":   {"include": ["user"]}
            });
        },

        createPeerReview: function(courseID, assignmentID, submissionID, userID, callback, error) {
            this._post({
                "callback": callback,
                "error":    error,
                "uri":      "/courses/" + courseID + "/assignments/" + assignmentID + "/submissions/" + submissionID + "/peer_reviews",
                "params":   { user_id: userID }
            });
        },

        //https://kurs.iktsenteret.no/api/v1/courses/41/enrollments?enrollment%5Bself_enrollment_code%5D=WJTLML&enrollment%5Buser_id%5D=self
        enrollUser: function(enrollAction, callback) {
            var jqxhr = $.post( enrollAction, function(data) {
                callback(data)
            });
        },
        createGroup: function(params, callback, error) {
            this._post({
                "callback": callback,
                "error":    error,
                "uri":      "/group_categories/" + params.category + "/groups",
                "params":   {
                    name: params.name,
                    description: params.description,
                    is_public: false,
                    join_level: 'invitation_only'
                }
            });
        },

        createGroupMembership: function(gid, uid, callback, error) {
            this._post({
                "callback": callback,
                "error":    error,
                "uri":      "/groups/" + gid + "/memberships",
                "params":   { user_id: uid }
            });

        },


        createUserLogin: function(params, callback, error) {
            var account_id = params.account_id;
            delete params.account_id;
            this._post({
                "callback": callback,
                "error": error,
                "uri": "/accounts/" + account_id + "/logins",
                "params": params
            });
        },

        getDiscussionTopic: function(courseId, contentId, callback) {
            this._get({
                "callback": callback,
                "uri":      "/courses/" + courseId + "/discussion_topics/" + contentId,
                "params":   { per_page: 999 }
            });
        },
        getQuiz: function(courseId, contentId, callback) {
            this._get({
                "callback": callback,
                "uri":      "/courses/" + courseId + "/quizzes/" + contentId,
                "params":   { per_page: 999 }
            });
        },

        getSpecificGroupDiscussionTopic: function(groupId, contentId, callback) {
            this._get({
                "callback": callback,
                "uri":      "/groups/" + groupId + "/discussion_topics/" +contentId,
                "params":   { per_page: 999 }
            });
        },

        getGroupDiscussionTopics: function(contentId, callback) {
            this._get({
                "callback": callback,
                "uri":      "/groups/" + contentId + "/discussion_topics/",
                "params":   { per_page: 999 }
            });
        },

        getAnnouncementsForCourse: function(courseId, callback) {
            this._get({
                "callback": callback,
                "uri":      "/courses/" + courseId + "/discussion_topics",
                "params":   { only_announcements: true, per_page: 999 }
            });
        },

        getEnrollmentsForCourse: function(courseId, params, callback) {
            this._get({
                "callback": callback,
                "uri":      "/courses/" + courseId + "/enrollments",
                "params":   params
            });
        },

        getCaledarEvents: function(params, callback) {
            this._get({
                "callback": callback,
                "uri":      "/calendar_events/",
                "params":   params
            });
        },

        //To be used later when displaying info about unread discussion comments.
        // getDiscussionTopics: function(courseId, callback) {
        //     this._get({
        //         "callback": callback,
        //         "uri":      "/courses/" + courseId + "/discussion_topics",
        //         "params":   { per_page: 999 }
        //     });
        // },

        markDiscussionTopicAsRead: function(courseId, contentId, callback) {
            this._put({
                "callback": callback,
                "uri":      "/courses/" + courseId + "/discussion_topics/" + contentId + "/read_all",
                "params":   { forced_read_state: 'false' }
            });
        }
    };
}();

if (typeof module !== "undefined" && module !== null) {
    module.exports = this.mmooc.api;
}


(function() {
    'use strict';

    var DISCUSSIONTYPE = 0;
    var ASSIGNMENTTYPE = 1;
    var QUIZTYPE = 2;
    var PAGETYPE = 3;

    var AllModuleItems = [];
    var error = function(error) {
        console.error("error calling api", error);
    };

    function updateOverallProgress(s)
    {
        $("#mmoocOverallProgress").html(s);
    }
    function getStyle(color, bgcolor)
    {
        return "style='background-color:" + bgcolor + ";color:" + color + "'";
    }
    function getBooleanOutput(result)
    {
        if(result)
        {
            return getStyle("white", "green") + ">JA";
        }
        return getStyle("white", "red") + ">NEI";
    }

    function clearTableWithId(id)
    {
        $("#" + id).html("");
    }

    function printRowInTableId(id, c1, c2)
    {
        var rowHtml = "<tr><td>" + c1 + "</td><td>" + c2 + "</td></tr>";
        $("#" + id).append(rowHtml);
    }
    function printRowWithColorInTableId(id, c1, c2, color, bgcolor)
    {
        var rowHtml = "<tr><td " + getStyle(color, bgcolor) + ">" + c1 + "</td><td "+ getStyle(color, bgcolor) + ">" + c2 + "</td></tr>";
        $("#" + id).append(rowHtml);
    }
    function printRedRowInTableId(id, c1, c2)
    {
        printRowWithColorInTableId(id,c1,c2,"white","red");
    }
    function printGreenRowInTableId(id, c1, c2)
    {
        printRowWithColorInTableId(id,c1,c2,"white","green");
    }


    function printRow(c1,c2)
    {
        return "<tr><td>" + c1 + "</td><td>" + c2 + "</td></tr>";
    }
    function printRowWithColor(c1,c2, color, bgcolor)
    {
        return "<tr><td" + getStyle(color, bgcolor) + ">" + c1 + "</td><td>" + c2 + "</td></tr>";
    }
    function printRedRow(c1,c2)
    {
        return printRowWithColor(c1,c2,"white","red");
    }
    function printGreenRow(c1,c2)
    {
        return printRowWithColor(c1,c2,"white","green");
    }

    function getSanityTableId(courseId, moduleId, contentId)
    {
        return "Sanity" + courseId + moduleId + contentId;
    }

    function getWaitIconRowId(tableId) {
        return "Wait" + tableId;
    }
    function waitIcon(tableId)
    {
        $("#" + tableId).append("<tr id='" + getWaitIconRowId(tableId) + "'>td><img src='https://matematikk-mooc.github.io/frontend/bitmaps/loading.gif'/>");
    }
    function clearWaitIcon(tableId)
    {
        $("#" + getWaitIconRowId(tableId)).remove();
    }

    function printPageTable(courseId, moduleId, item)
    {
        var contentHtml = "";
        return contentHtml;
    }
    function postProcessPageTable(courseId, moduleId, item)
    {
        var tableId = getSanityTableId(courseId, moduleId, item.id);
        var req = item.completion_requirement;
        if(req) {
            var reqtype = req.type;
            if(reqtype != "must_mark_done"){
                printRedRowInTableId(tableId, "Krav:", reqtype + "(Vi anbefaler merk som ferdig for innholdssider.)")
            }
        }
        else
        {
            printRowInTableId(tableId, "Ingen", "");
        }

        clearWaitIcon(tableId);
    }
    function printSubHeaderTable(courseId, moduleId, item)
    {
        var contentHtml = "";
        return contentHtml;
    }
    function postProcessSubHeaderTable(courseId, moduleId, item)
    {
        var tableId = getSanityTableId(courseId, moduleId, item.id);
        printRowInTableId(tableId, "Ingen", "")
        clearWaitIcon(tableId);
    }
    function printFileTable(courseId, moduleId, item) {
        var contentHtml = "";
        var req = item.completion_requirement;
        if (req) {
            var reqtype = req.type;
            if(reqtype != "must_mark_done") {
                contentHtml += printRedRow("Krav:", reqtype);
            }
        }
        return contentHtml;
    }
    function postProcessFileTable(courseId, moduleId, item) {
        var tableId = getSanityTableId(courseId, moduleId, item.id);
        printRowInTableId(tableId, "Ingen", "")
        clearWaitIcon(tableId);
    }
    function printDiscussionTable(courseId, moduleId, item) {
        var contentHtml = "";
        var req = item.completion_requirement;
        if (req) {
            var reqtype = req.type;
            if(reqtype != "must_contribute") {
                contentHtml += printRedRow("Krav:", reqtype);
            }
        }
        return contentHtml;
    }
    function postProcessDiscussionTable(courseId, moduleId, item) {
        var tableId = getSanityTableId(courseId, moduleId, item.id);
        var contentId = item.content_id;
        mmooc.api.getDiscussionTopic(courseId, contentId, (function(tableId) {
            return function(d) {
                clearWaitIcon(tableId);
                if(d.discussion_type != "side_comment") {
                    printRedRowInTableId(tableId, "Trådtype:", d.discussion_type + "(Vi anbefaler side_comment.)");
                }
                var gid = d.group_category_id;
                if(gid) {
                    printRedRowInTableId(tableId, "Gruppekategori:", "Mangler (Dette blir en diskusjon hvor samtlige studenter deltar. Vi anbefaler gruppediskusjoner dersom det er mange studenter.)");
                }
            }
        }(tableId)));
    }

    function printAssignmentTable(courseId, moduleId, item)
    {
        var contentHtml = "";
        var req = item.completion_requirement;
        if (req)
        {
            var reqtype = req.type;
            if(reqtype != "must_submit") {
                contentHtml += printRedRow("Krav:", reqtype + " på innleveringsoppgave.");
            }
        }

        return contentHtml;
    }
    function postProcessAssignmentTable(courseId, moduleId, item)
    {
        var contentId = item.content_id;
        var tableId = getSanityTableId(courseId, moduleId, item.id);
        mmooc.api.getSingleAssignment(courseId, contentId, (function(tableId) {
            return function(a) {
                clearWaitIcon(tableId);
                printRowInTableId(tableId, "Type:", a.submission_types);
                console.log("Assignment submission type: " + a.submission_types);
                if(a.submission_types.indexOf("online_upload") > -1)
                {
                    if(a.allowed_extensions)
                    {
                        printRowInTableId(tableId, "Tillatte filendelser:", a.allowed_extensions);
                    }
                    else
                    {
                        printRedRowInTableId(tableId, "Ingen tillatte filendelser spesifisert. Vi anbefaler å sette dette.");
                    }
                }
                if(!a.due_at)
                {
                    printRedRowInTableId(tableId, "Frist:", "Ingen. (Vi anbefaler å ha en frist)");
                }
                else
                {
                    printRowInTableId(tableId, "Frist:", a.due_at);
                }
                printRowInTableId(tableId, "Hverandrevurdering:", a.peer_reviews);
                if(a.peer_reviews) {
                    if(a.automatic_peer_reviews) {
                        var hvvfrist = "ingen";
                        hvvfrist = a.peer_reviews_assign_at;
                        printRedRowInTableId(tableId, "Tildeling av hverandrevurdering:", hvvfrist + " (Vi anbefaler ikke automatisk tildeling.");
                        printRowInTableId(tableId, "Antall vurderinger:", a.peer_review_count);
                    }
                    else
                    {
                        printGreenRowInTableId(tableId, "Tildeling av hverandrevurdering: ", "Manuell. Dette er anbefalt. Husk å legge fristen i kalenderen.");
                    }
                }
            }
        }(tableId)), error);
    }

    function printQuizTable(courseId, moduleId, item) {
        var contentHtml = "";
        var req = item.completion_requirement;
        if (req) {
            var reqtype = req.type;
            if(reqtype != "min_score") {
                contentHtml += printRedRow("Krav:", reqtype + " på quiz.");
            }
        }
        return contentHtml;
    }
    function postProcessQuizTable(courseId, moduleId, item) {
        var contentId = item.content_id;
        var tableId = getSanityTableId(courseId, moduleId, item.id);
        mmooc.api.getQuiz(courseId, contentId, (function(tableId) {
            return function(q) {
                clearWaitIcon(tableId);
                printRowInTableId(tableId, "Frist:", q.due_at);
            }
        }(tableId)));
    }


    function printSanityTableForItem(courseId, moduleId, item) {
        var tableId = getSanityTableId(courseId, moduleId, item.id);
        var contentHtml = "<table id='" + tableId + "'>";
        var type = item.type;
        console.log("Item type:" + type);
        if(type == "Assignment") {
            contentHtml += printAssignmentTable(courseId, moduleId, item);
        } else if (type == "Discussion") {
            contentHtml += printDiscussionTable(courseId, moduleId, item);
        } else if(type == "Page") {
            contentHtml += printPageTable(courseId, moduleId, item)
        } else if(type == "Quiz") {
            contentHtml += printQuizTable(courseId, moduleId, item);
        } else if(type == "File") {
            contentHtml += printFileTable(courseId, moduleId, item);
        } else if(type == "SubHeader") {
            contentHtml += printSubHeaderTable(courseId, moduleId, item);
        }
        waitIcon(tableId);
        contentHtml += "</table>";
        return contentHtml;
    }

    function postProcessSanityTableForItem(courseId, moduleId, item) {
        var type = item.type;
        if(type == "Assignment") {
            postProcessAssignmentTable(courseId, moduleId, item);
        } else if (type == "Discussion") {
            postProcessDiscussionTable(courseId, moduleId, item);
        } else if(type == "Page") {
            postProcessPageTable(courseId, moduleId, item)
        } else if(type == "Quiz") {
            postProcessQuizTable(courseId, moduleId, item);
        } else if(type == "File") {
            postProcessFileTable(courseId, moduleId, item);
        } else if(type == "SubHeader") {
            postProcessSubHeaderTable(courseId, moduleId, item);
        }
    }

    function getCommonUrlKey(url)
    {
        var key = "";
        var urlPrefix = "/courses";

        var start = url.indexOf(urlPrefix);
        if(start > -1)
        {
             key = url.substr(start);
        }
        else
        {
            console.log("getCommonUrlKey: Could not find key for url: " + url);
        }
        return key;
    }

    function storeItem(item)
    {
        if(item.type=="SubHeader")
        {
            return;
        }
        var url = item.url;

        var key = getCommonUrlKey(url);

        AllModuleItems[key] = item;
    }

    function getSanityTableForModule(courseId, module)
    {
        var contentHtml = "<table class='table'><thead><tr><th>Innholdselement</th><th>Publisert</th><th>Krav</th><th>Type</th><th>Detaljer</th></tr></thead><tbody>";
        var moduleItems = module.items;
        var moduleId = module.id;
        for (var i = 0; i < moduleItems.length; i++)
        {
            var item = moduleItems[i];

            storeItem(item);

            contentHtml += "<td>" + item.title + "</td>";

            contentHtml += "<td " + getBooleanOutput(item.published) + "</td>";
            var req = item.completion_requirement;
            contentHtml += "<td " + getBooleanOutput(req);
            if(req)
            {
                var reqtype = req.type;
                contentHtml += " (" + reqtype + ")";
                contentHtml += " ";
                if(reqtype == "min_score")
                {
                    var min_score = req.min_score;
                    contentHtml += "<br/>Min score: " + min_score;
                }
            }
            contentHtml += "</td><td>";
            contentHtml += item.type;
            contentHtml += "</td><td>";
            contentHtml +=  printSanityTableForItem(courseId, moduleId, item);
            contentHtml += "</td>";
            contentHtml += "</tr>";
        } //End for all module items.
        contentHtml += "</tbody></table>";
        return contentHtml;
    }
    function postProcessSanityTableForModule(courseId, module)
    {
        var moduleItems = module.items;
        var moduleId = module.id;
        for (var i = 0; i < moduleItems.length; i++)
        {
            var item = moduleItems[i];
            postProcessSanityTableForItem(courseId, moduleId, item);
        }
    }

    function processModules(courseId, modules){
        var contentHtml = "";
        for (var i = 0; i < modules.length; i++) {
           var module = modules[i];

           contentHtml += "<p><b>Modulnavn:" + module.name + "</b></p>";
           contentHtml += "<p>Publisert: <span " + getBooleanOutput(module.published) + "</span></p>";

           contentHtml += getSanityTableForModule(courseId, module);
           contentHtml += "<hr/>";
        } //End for all modules
        return contentHtml;
    } //end function

    function postProcessModules(courseId, modules){
        for (var i = 0; i < modules.length; i++) {
           var module = modules[i];
           postProcessSanityTableForModule(courseId, module);
        } //End for all modules
    } //end function


    function getTitle(item, pageType) {
        var title = "";
        if((pageType == DISCUSSIONTYPE) || (pageType == PAGETYPE)) {
            title = item.title;
        }
        else {
            title = item.name;
        }
        return title;
    }
    function getPublishedString(item) {
        var s = "NEI";
        if (item.published)
        {
            s = "<span style='bgcolor=red;color=white'>JA</span>";
        }
        return s
    }

    function getOrphanTableId(pageType) {
        return "pageType" + pageType;
    }
    function createTable(pageType, description)
    {
        var contentHtml = "<h2>" + description + "</h2>" + "<table class='table' id='" + getOrphanTableId(pageType) + "'>";
        contentHtml += "<thead><tr><th>Publisert</th><th>Tittel</th><th>Lenke</th></tr></thead><tbody></tbody></table>";
        return contentHtml;
    }
    function printRowWithColorInOrphanTable(pageType, c1, c2,c3, color, bgcolor)
    {
        var rowHtml = "<tr><td " + getStyle(color, bgcolor) + ">" + c1 + "</td><td "+ getStyle(color, bgcolor) + ">" + c2 + "</td><td "+ getStyle(color, bgcolor) + ">" + c3 + "</td></tr>";
        $("#" + getOrphanTableId(pageType)).append(rowHtml);
    }
    function printRedRowInOrphanTable(pageType, c1, c2, c3) {
        printRowWithColorInOrphanTable(pageType, c1, c2,c3, "white", "red");
    }
    function printGreenRowInOrphanTable(pageType, c1, c2, c3) {
        printRowWithColorInOrphanTable(pageType, c1, c2,c3, "white", "green");
    }


    function getOrphanItemsTable(itemList, pageType) {
        var orphans = false;
        for (var i = 0; i < itemList.length; i++) {
            var item = itemList[i];
            var key = getCommonUrlKey(item.html_url);
            var moduleItem = AllModuleItems[key];
            if(!moduleItem) {
                var title = getTitle(item, pageType);
                var published = getPublishedString(item);
                printRedRowInOrphanTable(pageType, published, title, key);
                orphans = true;
            }
        }
        if(!orphans) {
            printGreenRowInOrphanTable(pageType, "Ingen", "", "");
        }
	}

    ////////
    //MAIN
    ////////
    //Her lager vi knappen i Canvas!
    $("#right-side table.summary").before("<a id='sanitycheck' class='Button Button--link Button--link--has-divider Button--course-settings' href='#'><i class='icon-student-view' />Sanity check</a>");

    //Når man trykker på knappen så kjører koden nedenfor.
    $('#sanitycheck').on('click', function() {
        var contentarea = $('#content');
        var contentHtml = "";
        contentarea.html('<h1>Sanity check</h1>\
<div id="mmoocOverallProgress"></div>\
<div id="resultarea"></div>');

        var courseId = mmooc.api.getCurrentCourseId();
        updateOverallProgress("Henter kursinformasjon...");
        mmooc.api.getCourse(courseId, function(course) {
            contentHtml += "<p><b>Kursnavn:</b> " + course.name + "</p>";
            contentHtml += "<p>Publisert: <span " + getBooleanOutput(course.published) + "</span></p>";

            contentHtml += createTable(PAGETYPE, "Løsrevne sider");
            contentHtml += createTable(ASSIGNMENTTYPE, "Løsrevne oppgaver");
            contentHtml += createTable(DISCUSSIONTYPE, "Løsrevne diskusjoner");
            contentHtml += createTable(QUIZTYPE, "Løsrevne quizer");

            mmooc.api.getModulesForCurrentCourse(function(modules) {
                contentHtml += processModules(courseId, modules);
                $("#resultarea").html(contentHtml);
                postProcessModules(courseId, modules);

                mmooc.api.getPagesForCourse(courseId, function(pages) {
                    getOrphanItemsTable(pages, PAGETYPE);
                });
                mmooc.api.getAssignmentsForCourse(courseId, function(assignments) {
                    getOrphanItemsTable(assignments, ASSIGNMENTTYPE);
                });
                mmooc.api.getDiscussionTopicsForCourse(courseId, function(discussions) {
                    getOrphanItemsTable(discussions, DISCUSSIONTYPE);
                });
                mmooc.api.getQuizzesForCourse(courseId, function(quizzes) {
                    getOrphanItemsTable(quizzes, QUIZTYPE);
                });

            }, error);
        }, error);

    });
})();
