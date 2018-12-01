const IS_DEBUG = false;
var startTime = Date.now();
var intervalsPassed = 0;
var parser = new DOMParser();

function log(message)
{
    if (IS_DEBUG) console.log(message);
}

function extractByTerm(searchTerm)
{
    searchTerm = searchTerm.toUpperCase();
    var aTags = document.getElementsByTagName("li");
    let text;
    for (let i = 0; i < aTags.length; i++)
    {
        if (aTags[i].textContent.toUpperCase().indexOf(searchTerm) > -1)
        {
            text = aTags[i].textContent.toUpperCase().replace(searchTerm, '').trim();
            break;
        }
    }
    return text;
}

function findAsinOrIsbnText()
{
    let found = extractByTerm("isbn-10:");
    if (found === undefined) found = extractByTerm("isbn-13:");
    if (found === undefined) found = extractByTerm("asin:");
    //log("found: " + found);
    return found;
}
/**
 * Search for the Amazon identification number
 */
function getASIN()
{
    // Method 1
    var asin = findAsinOrIsbnText();
    if (asin !== undefined) //log("Method 1 asin found: " + asin);
        // Method 2
        if (asin === undefined)
        {
            var asin = document.querySelectorAll('[data-detailpageasin]')[0];
            if (asin !== undefined)
            {
                asin = asin.getAttribute('data-detailpageasin');
                //log("Method 2 asin found: " + asin);
            }
        }
    // Method 3
    if (asin === undefined)
    {
        // ASIN not found (not Amazon.com), search again by hidden input
        asin = document.querySelectorAll("input[name*=ASIN]")[0]
        if (asin !== undefined)
        {
            asin = asin.value;
            //log("Method 3 asin found: " + asin);
        }
    }
    // Method 4
    if (asin === undefined)
    {
        asin = document.querySelectorAll('[data-asin]')[0];
        if (asin !== undefined)
        {
            asin = asin.getAttribute('data-asin');
            //log("Method 4 asin found: " + asin);
        }
    }
    // Everything fails, all is lost
    if (asin === undefined || asin.length === 0 || asin.trim() === "")
    {
        //log("GoodreadsForAmazon: ASIN not found");
        return false;
    }
    return asin;
}
/**
 * ISBN-10 to ISBN-13 conversor
 * http://www.dispersiondesign.com/articles/isbn/converting_isbn10_to_isbn13
 */
function isbn10to13(isbn10)
{
    //log("isbn10to13 : isbn10 = " + isbn10);
    // Get every char into an array
    var chars = isbn10.split("");
    // Prepend 978 code
    chars.unshift("9", "7", "8");
    // Remove last check digit from isbn10
    chars.pop();
    // Convert to isbn-13
    var i = 0;
    var sum = 0;
    for (i = 0; i < 12; i++)
    {
        sum += chars[i] * ((i % 2) ? 3 : 1);
    }
    var check_digit = (10 - (sum % 10)) % 10;
    chars.push(check_digit);
    // Array back to string
    var isbn13 = chars.join("");
    // Conversion failed?
    if (isbn13.indexOf("NaN") !== -1)
    {
        isbn13 = "";
    }
    //log("isbn13 = " + isbn13);
    return isbn13;
}
/**
 * Sanitizer, removes all html tags, leave text
 */
var tagBody = '(?:[^"\'>]|"[^"]*"|\'[^\']*\')*';
var tagOrComment = new RegExp('<(?:'
    // Comment body.
    + '!--(?:(?:-*[^->])*--+|-?)'
    // Special "raw text" elements whose content should be elided.
    + '|script\\b' + tagBody + '>[\\s\\S]*?</script\\s*' + '|style\\b' + tagBody + '>[\\s\\S]*?</style\\s*'
    // Regular name
    + '|/?[a-z]' + tagBody + ')>', 'gi');

function removeTags(html)
{
    var oldHtml;
    do {
        oldHtml = html;
        html = html.replace(tagOrComment, '');
    } while (html !== oldHtml);
    return html.replace(/</g, '&lt;');
}
/**
 * Get book reviews from ASIN number and show rating
 * last = boolean. Checks if is the last recursive pass
 */
function retrieveBookInfo(asin, last)
{
    var urlGoodreads = "https://www.goodreads.com/book/isbn?isbn=" + asin;
    //log("Retrieving goodreads info from url: " + urlGoodreads);
    fetch(urlGoodreads).then((resp) => resp.text()).then(function(data)
    {
        let doc = parser.parseFromString(data, "text/html");
        // GET RATINGS INFO
        let meta = doc.querySelectorAll("#bookMeta");
        //log("url data retrieved. meta selector: " + meta);
        //log("meta.length: " + meta.length);
        for (let i = 0, element;
            (element = meta[i]); i++)
        {
            //log(element);
        }
        if (meta.length === 0)
        {
            // Check once more with isbn13 (in case the asin is really a isbn10)
            if (last === false)
            {
                asin = isbn10to13(asin);
                if (asin !== "")
                {
                    retrieveBookInfo(asin, true);
                }
            }
            //log("Goodreads info not found for book : " + asin);
            return;
        }
        meta = meta[0];
        // CREATE TAGS FOR AMAZON
        // Append content
        var parentSpan = "<br/><span id='goodreadsRating' class='goodreadsRating'>";
        // Stars
        var stars = meta.querySelectorAll(".stars")[0];
        if (stars === undefined || stars === null)
        {
            //log("Cannot find '.stars' info on page");
            return;
        }
        // Create manually to avoid injection
        parentSpan += "<span class='stars staticStars'>";
        for (var i = 0; i < stars.children.length; i++)
        {
            parentSpan += "<span class='" + stars.children[i].className + "' size=12x12></span>";
        }
        parentSpan += "</span>";
        // Spacing
        parentSpan += "<span class='a-letter-space'></span><span class='a-letter-space'></span>";
        // Review count and link to Goodreads
        var averageHtml = meta.querySelectorAll("[itemprop=ratingValue]")[0].textContent;
        var votesHtml = meta.querySelectorAll("[itemprop=ratingCount]")[0].parentNode.textContent;
        log(votesHtml);
        log(removeTags(votesHtml).trim());
        // Clean html 
        var reviewCount = removeTags(averageHtml).trim() + " from " + removeTags(votesHtml).trim();
        parentSpan += "<a href='" + urlGoodreads + "'>" + reviewCount + "</a>";
        // APPEND TO AMAZON PAGE
        // Get reviews section
        // NOTE: Amazon is a mess, usually #averageCusomerReviews exists, but sometimes it won't use it
        // and put the reviews link into #cmrsSummary-popover
        var amazonReview = document.querySelectorAll("#cmrs-atf, #acrCustomerReviewLink");
        if (amazonReview.length !== 0)
        {
            amazonReview = amazonReview[0].parentNode;
            //log("amazonReview: " + amazonReview);
        }
        else
        {
            // //log("GoodreadsForAmazon: #cmrs-atf or #acrCustomerReviewLink not found. Trying with #averageCusomerReviews");
            amazonReview = document.querySelectorAll("#averageCustomerReviews");
        }
        // If not found is not .com and uses different html ¬¬
        if (amazonReview.length === 0)
        {
            var amazonReview = document.querySelectorAll(".buying .crAvgStars");
            // No crAvgStars, search .buying inside .buying (yes, wtf)
            if (amazonReview.length === 0)
            {
                // //log("GoodreadsForAmazon: .crAvgStars not found. Trying with .buying");
                // Here we go... holy shit Amazon, please define the different parts of your pages properly
                amazonReview = document.querySelectorAll(".buying .tiny a");
                if (amazonReview.length !== 0)
                {
                    amazonReview = amazonReview[0].parentNode
                }
            }
        }
        if (amazonReview[0] !== undefined)
        {
            amazonReview = amazonReview[0];
        }
        parentSpan += "</span>";
        // Parse into html object and select goodreadsRating
        var spanObject = parser.parseFromString(parentSpan, "text/html").querySelector("#goodreadsRating");
        //log("Span object : " + spanObject);
        // Append to reviews
        amazonReview.appendChild(spanObject);
    });
}
/**
 * Check if the current article is a book in any form
 */
function checkIfBook()
{
    return document.getElementById("booksTitle") !== null || document.getElementById("bookEdition") !== null;
}
/**
 * START POINT
 */
// Try to get the book info as soon as possible
var asinFound = false;
var startTime = Date.now();
if (checkIfBook())
{
    var asinChecker = window.setInterval(function()
    {
        intervalsPassed++;
        // //log("Inverval number " + intervalsPassed);
        var asin = getASIN();
        // Is ASIN found, stop and retrieve book info
        if (asin !== false)
        { // ASIN found
            window.clearInterval(asinChecker);
            asinFound = true; // No need to check anymore
            retrieveBookInfo(asin, false);
        }
        // After 10 seconds stop checking for ASIN
        var timeInSeconds = Math.floor((Date.now() - startTime)) / 1000;
        var stopChecks = timeInSeconds > 10;
        if (stopChecks === true)
        {
            window.clearInterval(asinChecker);
        }
    }, 500);
    /**
     * After loading page check if ASIN was found or try once more
     */
    document.addEventListener("DOMContentLoaded", function()
    {
        //log("Page loaded in " + (Date.now() - startTime) + " ms");
        if (!asinFound)
        {
            // Always remove interval (if ASIN not found, should exists)
            window.clearInterval(asinChecker);
            var asin = getASIN();
            //log("Document load asin found? : " + asin);
            if (asin !== false)
            { // ASIN found
                retrieveBookInfo(asin, false);
            }
            else
            {
                //log("Book not found. THE END.");
            }
        }
    });
}