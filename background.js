chrome.runtime.onMessage.addListener(function(request, sender, sendResponse)
{
    if (request.contentScriptQuery == "fetchHtml")
    {
        fetch(request.url)
            .then(response => response.text())
            .then(data => sendResponse(data))
            .catch(error => sendResponse(error))
        return true; // Will respond asynchronously.
    }
});