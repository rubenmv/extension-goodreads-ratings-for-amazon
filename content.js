const IS_DEBUG = false;
const ASIN_RETRIEVE_INTERVAL = 500;
const BOOKINFO_RETRIEVE_INTERVAL = 1000;
var startTime = Date.now();
var intervalsPassed = 0;
var parser = new DOMParser();
var isAudibleCom = false;
var infoFound = false;
var ogUrl = null;


function log(message) {
	if (IS_DEBUG) console.log(message);
}

function logex(methodName, message) {
	if (IS_DEBUG) console.log("Exception in " + methodName + ": " + message);
}

function extractByTerm(searchTerm, rootElement = document) {
	searchTerm = searchTerm.toUpperCase();
	let aTags = rootElement.getElementsByTagName("li");
	let text;
	for (let i = 0; i < aTags.length; i++) {
		if (aTags[i].textContent.toUpperCase().replace(' ', '').replace(/(\r\n|\n|\r)/gm, '').indexOf(searchTerm) > -1) {
			console.log("Found text: " + aTags[i].textContent);
			text = aTags[i].textContent.toUpperCase().replace(/(\r\n|\n|\r)/gm, '').replace(searchTerm, '').trim();
			break;
		}
	}
	return text;
}

function findAsinOrIsbnText() {
	let found;

	// https://www.amazon.com/Short-Novels-John-Steinbeck-Classics-ebook-dp-B002L4EX9C/dp/B002L4EX9C
	let details = document.getElementById("detailBullets_feature_div");
	if (details) found = extractByTerm("asin:", details);
	if (!found) {
		found = extractByTerm("isbn-10:");
		if (!found) found = extractByTerm("isbn-13:");
		if (!found) found = extractByTerm("asin:");
	}

	log("found: " + found);
	return found;
}
/**
 * Search for the Amazon identification number
 */
function getASIN() {
	var asin = [];

	try {
		// Audible
		if (isAudibleCom) {
			log("IsAudible. Searching for ASIN...");
			// Method 1
			var iframe = document.getElementById('adbl-amzn-portlet-reviews');
			var innerDoc = iframe.contentDocument || iframe.contentWindow.document;
			var stateObject = innerDoc.getElementById('cr-state-object');
			if (stateObject !== null) {
				var dataStateString = stateObject.getAttribute('data-state');
				if (dataStateString !== null) {
					var dataStateJson = JSON.parse(dataStateString);
					asin.push(dataStateJson['asin']);
					log("Method 1 asin found: " + asin);
				}
			}
			// Method 2
			var asinElement = document.getElementById("reviewsAsinUS");
			if (asinElement === undefined) asinElement = document.getElementsByName("productAsin")[0];
			if (asinElement === undefined) asinElement = document.querySelectorAll("[data-asin]")[0].getAttribute("data-asin");
			asin.push(asinElement === undefined ? false : asinElement.value);
			log("Method 2 asin found: " + asin);
		}
		// Amazon
		else {
			log("Is Amazon. Searching for ISBN/ASIN...");
			// Method 1
			let asinText = findAsinOrIsbnText();
			if (asin !== undefined) {
				asin.push(asinText);
				log("Method 1 asin found: " + asin);
			}
			// Method 2
			let asinElement = document.querySelectorAll('[data-detailpageasin]')[0];
			if (asinElement !== undefined) {
				asin.push(asinElement.getAttribute('data-detailpageasin'));
				log("Method 2 asin found: " + asin);
			}
			// Method 3
			// ASIN not found (not Amazon.com), search again by hidden inputs
			let inputAsin = document.querySelectorAll("input[name*=ASIN]")[0];
			if (inputAsin !== undefined) {
				asin.push(inputAsin.value);
				log("Method 3 asin found: " + asin);
			}
			// Method 4
			let dataAsin = document.querySelectorAll('[data-asin]')[0];
			if (dataAsin !== undefined) {
				asin.push(dataAsin.getAttribute('data-asin'));
				log("Method 4 asin found: " + asin);
			}
		}
	} catch (error) {
		logex("getASIN", error);
	}

	// Limpiamos duplicados y vacios
	var filteredAsin = asin.filter(function (value, index, inputArray) {
		return value != null && value != "" &&
			(inputArray.indexOf(value) === index);
	});
	log("filteredAsin: " + filteredAsin);
	return filteredAsin;
}
/**
 * ISBN-10 to ISBN-13 conversor
 * http://www.dispersiondesign.com/articles/isbn/converting_isbn10_to_isbn13
 */
function isbn10to13(isbn10) {

	log("isbn10to13 : isbn10 = " + isbn10);
	var isbn13 = "";
	try {
		// Get every char into an array
		var chars = isbn10.split("");
		// Prepend 978 code
		chars.unshift("9", "7", "8");
		// Remove last check digit from isbn10
		chars.pop();
		// Convert to isbn-13
		var i = 0;
		var sum = 0;
		for (i = 0; i < 12; i++) {
			sum += chars[i] * ((i % 2) ? 3 : 1);
		}
		var check_digit = (10 - (sum % 10)) % 10;
		chars.push(check_digit);
		// Array back to string
		isbn13 = chars.join("");
		// Conversion failed?
		if (isbn13.indexOf("NaN") !== -1) {
			isbn13 = "";
		}
		log("isbn13 = " + isbn13);
	} catch (error) {
		logex("isbn10to13", error);
	}
	return isbn13;
}
/**
 * Sanitizer, removes all html tags, leave text
 */
var tagBody = '(?:[^"\'>]|"[^"]*"|\'[^\']*\')*';
var tagOrComment = new RegExp('<(?:'
	// Comment body.
	+
	'!--(?:(?:-*[^->])*--+|-?)'
	// Special "raw text" elements whose content should be elided.
	+
	'|script\\b' + tagBody + '>[\\s\\S]*?</script\\s*' + '|style\\b' + tagBody + '>[\\s\\S]*?</style\\s*'
	// Regular name
	+
	'|/?[a-z]' + tagBody + ')>', 'gi');

function removeTags(html) {
	var oldHtml;
	do {
		oldHtml = html;
		html = html.replace(tagOrComment, '');
	} while (html !== oldHtml);
	return html.replace(/</g, '&lt;');
}

function GetStarsContent(meta, stars, isNewStyle) {
	let spanContent = '';
	if (!isNewStyle) {
		for (var i = 0; i < stars.children.length; i++) {
			spanContent += "<span class='" + stars.children[i].className + "' size=12x12></span>";
		}
		return spanContent;
	}
	// Quick and really dirty hack for the new goodreads style when retrieving from Chrome
	let decimalNumber = parseFloat(meta.querySelector('.RatingStatistics__rating').textContent);
	let entero = Math.floor(decimalNumber);
	let decimalPart = decimalNumber - entero;
	for (var i = 0; i < stars.children.length; i++) {
		let currentStar = stars.children[i];
		let currentStarPaths = currentStar.querySelectorAll('path');
		let containsEmpty = currentStar.querySelector('.RatingStar__backgroundFill');
		let containsFill = currentStar.querySelector('.RatingStar__fill')?.getAttribute('d'); // class + attribute
		if (containsEmpty && containsFill) { 
			if (decimalPart <= 0.5) spanContent += "<span class='staticStar p3' size=12x12></span>";
			else spanContent += "<span class='staticStar p6' size=12x12></span>";
		}
		else { // only empty or fully filled star
			if (containsEmpty) {
				spanContent += "<span class='staticStar p0' size=12x12></span>";
			}
			if (containsFill) {
				spanContent += "<span class='staticStar p10' size=12x12></span>";
			}
		}
	}

	return spanContent;
}

function processResponse(asin, meta, goodreadsLink, last) {
	if (infoFound) return;
	if (meta.length === 0) {
		// Check once more with isbn13 (in case the asin is really a isbn10)
		if (last === false) {
			log("Try again but with isbn13");
			asin = isbn10to13(asin);
			if (asin !== "") {
				retrieveBookInfo(asin, true);
				return;
			}
		}
		
		log("Goodreads info not found for this book. Goodbye.");
		return;
	}
	meta = meta[0];

	let newStyle = false;

	// CREATE TAGS
	// Stars
	var stars = meta.querySelectorAll(".stars")[0];

	if (stars === undefined || stars === null) {
		stars = meta.querySelectorAll(".RatingStars")[0];
		newStyle = true;
	}

	if (stars === undefined || stars === null) {
		log("Cannot find '.stars' info on page");
		return;
	}

	log("Is new Style? " + newStyle);

	// Mark info found
	infoFound = true;

	// Check to be sure the info was not already added to the page
	var goodreadsTag = document.getElementById('goodreadsRating');
	if (goodreadsTag !== undefined && goodreadsTag !== null) return;

	var parentSpan = "<br/><span id='goodreadsRating' class='goodreadsRating'>";
	// Create manually to avoid injection
	parentSpan += "<span class='stars staticStars'>";
	let starsContent = GetStarsContent(meta, stars, newStyle);
	log('Stars Content: ' + starsContent);
	parentSpan += starsContent;
	parentSpan += "</span>";
	// Spacing
	parentSpan += "<span class='a-letter-space'></span><span class='a-letter-space'></span>";
	// Review count and link to Goodreads
	var averageHtml = meta.querySelector("[itemprop=ratingValue]")?.textContent ?? meta.querySelector('.RatingStatistics__rating')?.textContent;
	var votesHtml = meta.querySelector("[itemprop=ratingCount]")?.parentNode?.textContent ?? meta.querySelector("[data-testid=ratingsCount]")?.textContent;
	log(votesHtml);
	log(removeTags(votesHtml)
		.trim());
	// Clean html 
	var reviewCount = removeTags(averageHtml)
		.trim() + " from " + removeTags(votesHtml)
			.trim();
	parentSpan += "<a ";
	// Different font for audible
	if (isAudibleCom) { parentSpan += "class='audibleFont' "; }
	parentSpan += "href='" + goodreadsLink + "'>" + reviewCount + "</a>";
	parentSpan += "</span>";
	// Parse into html object and select goodreadsRating
	var contentSpan = parser.parseFromString(parentSpan, "text/html")
		.querySelector("#goodreadsRating");
	// FINALLY APPEND TO PAGE
	log("Span object : " + contentSpan);
	// Audible.com
	if (isAudibleCom) AppendToAudible(contentSpan);
	// Amazon
	else AppendToAmazon(contentSpan);
}

/**
 * Get book reviews from ASIN number and show rating
 * last = boolean. Checks if is the last recursive pass
 */
function retrieveBookInfo(asin, last) {
	var urlGoodreads = ogUrl ?? "https://www.goodreads.com/book/isbn?isbn=" + asin;
	log("Retrieving goodreads info from url: " + urlGoodreads);
	chrome.runtime.sendMessage({
		contentScriptQuery: "fetchHtml",
		url: urlGoodreads
	}, data => {
		try {
			
			let doc = parser.parseFromString(data, "text/html");
			// log(data);
			// GET RATINGS INFO
			let meta = doc.querySelectorAll("#bookMeta");
			if(!meta || meta.length === 0){
				log("bookMeta not found, searching for .BookPageMetadataSection");
				meta = doc.querySelectorAll(".BookPageMetadataSection");
			}
			
			if(!tryAgainWithOg && (!meta || meta.length === 0)) { // tryAgainWithOg: so it tries only once
				ogUrl = doc.querySelector('meta[property="og:url"]')?.content;
			}
			
			log("Info retrieved. #bookMeta tag: " + meta.length + " nodes");
			if (meta.length === 0) meta = doc.querySelectorAll(".BookPageMetadataSection__ratingStats");
			log("url data retrieved. meta selector: " + meta.values);
			log(meta[0]);
			log("meta.length: " + meta.length);
			for (let i = 0, element;
				(element = meta[i]); i++) {
				log(element);
			}
			processResponse(asin, meta, urlGoodreads, last);
		} catch (error) {
			logex("retrieveBookInfo", error);
		}
	});
}

function AppendToAudible(contentSpan) {
	log("AppendToAudible");
	var ratingsLabel = document.getElementsByClassName("ratingsLabel");
	if (ratingsLabel.length > 0) {
		var parentUl = ratingsLabel[0].parentNode;
		parentUl.insertBefore(contentSpan, ratingsLabel[0]);
	}
}
/**
 * Appends ratings to Amazon page
 */
function AppendToAmazon(contentSpan) {
	log("AppendToAmazon");
	// APPEND TO AMAZON PAGE
	// Get reviews section
	// NOTE: Amazon is a mess, usually #averageCusomerReviews exists, but sometimes it won't use it
	// and put the reviews link into #cmrsSummary-popover
	var amazonReview = document.querySelectorAll("#cmrs-atf, #acrCustomerReviewLink");
	if (amazonReview.length !== 0) {
		amazonReview = amazonReview[0].parentNode;
		log("amazonReview: " + amazonReview);
	} else {
		log("GoodreadsForAmazon: #cmrs-atf or #acrCustomerReviewLink not found. Trying with #averageCusomerReviews");
		amazonReview = document.querySelectorAll("#averageCustomerReviews");
	}
	// If not found is not .com and uses different html ¬¬
	if (amazonReview.length === 0) {
		var amazonReview = document.querySelectorAll(".buying .crAvgStars");
		// No crAvgStars, search .buying inside .buying (yes, wtf)
		if (amazonReview.length === 0) {
			log("GoodreadsForAmazon: .crAvgStars not found. Trying with .buying");
			// Here we go... holy shit Amazon, please define the different parts of your pages properly
			amazonReview = document.querySelectorAll(".buying .tiny a");
			if (amazonReview.length !== 0) {
				amazonReview = amazonReview[0].parentNode
			}
		}
	}
	if (amazonReview[0] !== undefined) {
		amazonReview = amazonReview[0];
	}
	// Append to reviews
	amazonReview.appendChild(contentSpan);
}

function SelectById(idArray) {
	for (let i = 0; i < idArray.length; i++) {
		var element = document.getElementById(idArray[i]);
		if (element !== null) return element;
	}
	return null;
}

/**
 * Check if the current article is a book in any form
 */
function checkIfBook() {
	log("checkIfBook");
	// Audible
	if (isAudibleCom) return window.location.href.indexOf("audible.com/pd") > 0;
	// Amazon
	var bookDetectionIdArray = ["ebooksImageBlockOuter", "booksTitle", "bookEdition", "pBookUpsellBorrowButton", "booksImageBlock_feature_div"];
	return SelectById(bookDetectionIdArray) !== null;
}
/**
 * START POINT
 */
// Try to get the book info as soon as possible
var asinFound = false;
var startTime = Date.now();
var goodreadsRetrieveInternal = 0;
var currentAsin;
// Check if the domain is Amazon or Audible
isAudibleCom = window.location.hostname.indexOf("audible.com") > 0;
log("isAudibleCom = " + isAudibleCom);
if (checkIfBook()) {
	log("Is book page");
	var asinChecker = window.setInterval(function () {
		intervalsPassed++;
		log("Inverval number " + intervalsPassed);
		var asin = getASIN();
		log("asin array length: " + asin.length);
		// Is ASIN found, stop and retrieve book info
		if (asin.length > 0) { // ASIN found
			window.clearInterval(asinChecker);
			asinFound = true; // No need to check anymore

			// Try to retrieve info about the book from the asin codes found
			var metaInfoChecker = window.setInterval(function () {
				goodreadsRetrieveInternal++;
				if (infoFound || goodreadsRetrieveInternal > 20) {
					log("asin length is " + asin.length + ", infoFound = " + infoFound);
					window.clearInterval(metaInfoChecker);
				} else {
					while(asin.length > 0 && !currentAsin){
						currentAsin = asin.pop();
					}
					log("Retrieving book info for asin/isbn number: " + currentAsin);
					retrieveBookInfo(currentAsin, false);
				}
			}, BOOKINFO_RETRIEVE_INTERVAL);
		}
		// After 10 seconds stop checking for ASIN
		var timeInSeconds = Math.floor((Date.now() - startTime)) / 1000;
		var stopChecks = timeInSeconds > 10;
		if (stopChecks === true) {
			window.clearInterval(asinChecker);
		}
	}, ASIN_RETRIEVE_INTERVAL);
	/**
	 * After loading page check if ASIN was found or try once more
	 */
	document.addEventListener("DOMContentLoaded", function () {
		log("Page loaded in " + (Date.now() - startTime) + " ms");
		if (!asinFound) {
			// Always remove interval (if ASIN not found, should exists)
			window.clearInterval(asinChecker);
			var asin = getASIN();
			log("asin array length: " + asin.length);
			log("Document load asin found? : " + asin);
			if (asin.length > 0) { // ASIN found
				// Try to retrieve info about the book from the asin codes found
				var metaInfoChecker = window.setInterval(function () {
					if (asin.length == 0 || infoFound) {
						window.clearInterval(metaInfoChecker);
					} else {
						var currentAsin = asin.pop();
						log("Retrieving book info for asin/isbn number: " + currentAsin);
						retrieveBookInfo(currentAsin, false);
					}
				}, BOOKINFO_RETRIEVE_INTERVAL);
			} else {
				log("Book not found. THE END.");
			}
		}
	});
} else {
	log("Is NOT book page");
}