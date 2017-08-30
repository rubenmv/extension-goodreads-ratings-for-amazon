var data = require("sdk/self").data;
var pageMod = require("sdk/page-mod");
var Request = require("sdk/request").Request;

pageMod.PageMod({
  include: ["http://www.amazon.*", "https://www.amazon.*"],
  contentStyleFile: [data.url("content.css")],
  contentScriptFile: [data.url("jquery-2.1.4.min.js"), data.url("content.js")],
  // Request from here, send to content script
  onAttach: function (worker) {
    worker.port.on("request", function (url) {
      Request({
        url: url,
        onComplete: function (response) {
          worker.port.emit("response", response.text)
        }
      }).get();
    });
  }
});

