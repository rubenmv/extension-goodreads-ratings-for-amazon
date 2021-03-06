var startTime = Date.now();
var intervalsPassed = 0;
var asin;
var urlGoodreads = "";

/**
 * Search for the Amazon identification number
 */
function getASIN() {
  // This selector should work on all Amazon sites 
  var asin = $("#amsDetailRight").data("detailpageasin"); // Amazon.com
  if (asin === undefined) {
    // ASIN not found (not Amazon.com), search again
    asin = $("input[name*=ASIN]").val();
    if (asin === undefined || asin.length === 0 || asin.trim() === "") {
      //console.log("GoodreadsForAmazon: ASIN not found");
      return false;
    }
  }
  return asin;
}

/**
 * Get book reviews from ASIN number and show rating
 */
function retrieveBookInfo(asin) {
  //console.log("Book found in " + (Date.now() - startTime) + " ms");

  urlGoodreads = "https://www.goodreads.com/book/isbn?isbn=" + asin;
  
  // Communicate with the main script to do the Request
  self.port.emit("request", urlGoodreads);
}

/**
 * Listen to the request response and parse goodreads data
 */
self.port.on("response", function (response) {
  // GET RATINGS INFO
  var meta = $(response).find("#bookMeta");
  if (meta.length === 0) {
    console.log("GoodreadsForAmazon: Goodreads meta info not found for ASIN = " + asin);
    return;
  }
  meta = meta[0];
  
  // Cleanup and create elements
  var span = document.createElement('span');
  $(span).addClass("goodreadsRating");
  $(span).append($(meta).find(".stars"));
  $(span).append("<a href='" + urlGoodreads + "'>" +
    $(meta).find(".value").text() + " out of 5. From " +
    $(meta).find(".votes").text() + "</a>");

  // APPEND TO AMAZON PAGE
  // Append to reviews section
  var amazonReview = $("#averageCustomerReviews");
  // If not found is not .com and uses different html ¬¬
  if (amazonReview.length === 0) {
    //console.log("GoodreadsForAmazon: averageCustomerReviews not found. Trying with class crAvgStars");
    amazonReview = $(".buying .crAvgStars");
  }
  // No Amazon reviews
  if (amazonReview.length === 0) {
    // console.log("GoodreadsForAmazon: crAvgStars not found. Trying with class buying");
    // Here we go... holy shit Amazon, identify the different parts of your pages properly
    amazonReview = $(".buying").find(".tiny").find("a");
    if (amazonReview.length !== 0) {
      amazonReview = amazonReview.parent();
    }
    else {
      
    }
  }
  $(amazonReview).append("<br/>");
  $(amazonReview).append(span);
});

// Try to get the book info as soon as possible
var asinFound = false;
var asinChecker = window.setInterval(function () {
  intervalsPassed++;
  // console.log("Inverval number " + intervalsPassed);

  asin = getASIN();
  if (asin !== false) { // ASIN found
    window.clearInterval(asinChecker);
    asinFound = true; // No need to check anymore
    retrieveBookInfo(asin);
  }
}, 200);


/**
 * After loading page check if ASIN was found or try once more
 */
$(document).ready(function () {
  // console.log("Page loaded in " + (Date.now() - startTime) + " ms");
  if (!asinFound) {
    // Always remove interval (if ASIN not found, should exists)
    window.clearInterval(asinChecker);
    asin = getASIN();
    if (asin !== false) { // ASIN found
      retrieveBookInfo(asin);
    } else {
      // console.log("Book not found. THE END.");
    }
  }
});