var uioufPath = window.location.pathname;
if (uioufPath.endsWith('/assignments/new') || (uioufPath.endsWith('/edit') && uioufPath.indexOf('/assignments/') != -1)){
    //Translate label if Bokmål or Nynorsk
    if (ENV.LOCALE == "nb" || ENV.LOCALE == "nn"){
       $("label[for='similarity_detection_tool']").text("Plagiatkontroll");
    }
    //Make sure reports are not sent to students
    var uioufPlagiarismtSelecttag = document.getElementById("report_visibility_picker_select");
    var uioufUrkundIntervall = setInterval(function (){
        uioufPlagiarismtSelecttag.value = 'never';
        uioufPlagiarismtSelecttag.disabled = true;
    },500);
}
