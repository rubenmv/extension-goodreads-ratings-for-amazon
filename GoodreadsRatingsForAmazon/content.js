const IS_DEBUG = false;
const BOOKINFO_RETRIEVE_INTERVAL = 1000;
const MAX_BOOK_CHECK_TRIES = 15;
const AUDIBLE_PATTERN = /^https?:\/\/(www\.)?audible\.[^/]+\/pd\//;
var checkInterval = 0;
var parser = new DOMParser();
var isAudibleCom = false;
var ogUrl = null;
var displayAmazonGoodreads = false;
var asinCheckedList = [];
var goodreadsRetrieveInternal = 0;
var finished = false; // book found, info appended to page
var baseAPI = typeof chrome !== 'undefined' ? chrome : browser;
var isBusy = false;

function uuidv4() {
	return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
		(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
}

function log(message, uid) {
	if (IS_DEBUG) console.log(uid + ' ::: ' + message);
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

	if (!found) {
		let reviewsDetail = document.getElementById('detailBullets_averageCustomerReviews');
		if (reviewsDetail) {
			found = reviewsDetail.getAttribute('data-asin');
			if (found === '') found = undefined;
		}
	}

	if (!found) {
		// https://www.amazon.com/Short-Novels-John-Steinbeck-Classics-ebook-dp-B002L4EX9C/dp/B002L4EX9C
		let details = document.getElementById("detailBullets_feature_div");
		if (details) found = extractByTerm("asin:", details);
		if (!found) {
			found = extractByTerm("isbn-10:");
			if (!found) {
				found = extractByTerm("isbn-13:");
			}
			if (!found) {
				found = extractByTerm("asin:");
			}
		}
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
			log("IsAudible. Searching for ASIN with Method 1...");
			var asinInput = document.getElementById('reviewsAsinForAmazonTab');
			if (asinInput) {
				asin.push(asinInput.value);
				log("asin found: " + asin);
			}
			log("IsAudible. Searching for ASIN with Method 2...");
			var iframe = document.getElementById('adbl-amzn-portlet-reviews');
			if (iframe) {
				var innerDoc = iframe.contentDocument || iframe.contentWindow?.document;
				var stateObject = innerDoc.getElementById('cr-state-object');
				if (stateObject !== null) {
					var dataStateString = stateObject.getAttribute('data-state');
					if (dataStateString !== null) {
						var dataStateJson = JSON.parse(dataStateString);
						asin.push(dataStateJson['asin']);
						log("asin found: " + asin);
					}
				}
			}

			log("IsAudible. Searching for ASIN with Method 3...");
			var asinElement = document.getElementById("reviewsAsinUS");
			if (!asinElement) {
				asinElement = document.getElementsByName("productAsin")[0];
			}
			if (!asinElement) {
				const dataAsinElements = document.querySelectorAll("[data-asin]");
				if (dataAsinElements.length > 0) {
					asinElement = dataAsinElements[0].getAttribute("data-asin");
				}
			}

			const asinValue = asinElement?.value || asinElement || false;
			asin.push(asinValue);
			log("asin found: " + asin);
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
			if (inputAsin === undefined) inputAsin = document.getElementsByName("items[0.base][asin]")[0];
			if (inputAsin === undefined) inputAsin = document.getElementsByName("items[0].action.asin")[0];

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

function processResponse(asin, meta, goodreadsLink, last, uid) {
	log("Process response", uid);
	if (finished) return;
	if (meta.length === 0) {
		// Check once more with isbn13 (in case the asin is really a isbn10)
		if (last === false) {
			log("Try again but with isbn13", uid);
			asin = isbn10to13(asin);
			if (asin !== "") {
				retrieveBookInfo(asin, true);
				return;
			}
		}

		log("Goodreads info not found for this book. Goodbye.", uid);
		isBusy = false;
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
		log("Cannot find '.stars' info on page", uid);
		isBusy = false;
		return;
	}

	log("Is new Style? " + newStyle, uid);

	// Check to be sure the info was not already added to the page
	var goodreadsTag = document.getElementById('goodreadsRating');
	if (goodreadsTag !== undefined && goodreadsTag !== null) {
		isBusy = false;
		return;
	}

	var parentSpan = "<br/><span id='goodreadsRating' class='goodreadsRating'>";
	// Create manually to avoid injection
	parentSpan += "<span class='stars staticStars'>";
	let starsContent = GetStarsContent(meta, stars, newStyle);
	log('Stars Content: ' + starsContent, uid);
	parentSpan += starsContent;
	parentSpan += "</span>";
	// Spacing
	parentSpan += "<span class='a-letter-space'></span><span class='a-letter-space'></span>";
	// Review count and link to Goodreads
	var averageHtml = meta.querySelector("[itemprop=ratingValue]")?.textContent ?? meta.querySelector('.RatingStatistics__rating')?.textContent;
	var votesHtml = meta.querySelector("[itemprop=ratingCount]")?.parentNode?.textContent ?? meta.querySelector("[data-testid=ratingsCount]")?.textContent;
	log(votesHtml, uid);
	log(removeTags(votesHtml, uid)
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
	log("Span object : " + contentSpan.textContent, uid);
	// Audible.com
	if (isAudibleCom) AppendToAudible(contentSpan);
	// Amazon
	else AppendToAmazon(contentSpan, uid);

	isBusy = false;
}

function applyStyle(htmlElement) {
	log("Applying styles to element");
	try {
		const styles = `
		.goodreadsRating {
			display: block;
			font-size: 13px !important;
			line-height: 19px!important;
			margin-top: 5px !important;
		}

		.audibleFont {
			font-family: "Audible Sans", Arial, sans-serif !important;
			font-size: 12px !important;
			font-weight: 600 !important;
			color: #0e5b9b !important;
		}

		.stars {
			margin-bottom: 0px !important;
			margin-right: 5px !important;
			min-width: 85px !important;
			height: 20px !important;
		}

		.staticStars {
			font-size: 0 !important;
			background-repeat: no-repeat !important;
			white-space: nowrap !important;
			display: inline-block !important;
			vertical-align: top !important;
		}

		.staticStar {
			width: 16px !important;
			height: 20px !important;
			float: left !important;
			background-repeat: no-repeat !important;
		}

		.staticStar.p0 {
			background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAABJklEQVR42p2RO4qDUBiFs4NsYZaQeppJLYI2l3EFgtVgL1i4AEHQ2kLFDQipbAQRC6OND/CxhCzhH4/FkIkaSIoPDufBvV4PRLQJx3EnAL3HbqAoigneGjuOM4GXx4yxUxRFBKBfGuu6bqZpSgB6dyyK4vkeSZLOQRBMVVURgIb32ON5/vtgGMbVtm2av2/B8zxKkoS6rgPQ8P5ydLERBOFzOT4Mw+WaeZ5TURTUNA0NwwCg4S0ZOuiuvnk2hfmkGwbjOP4DHjJ09h4Mv+erbdvVGB6yp69tWZZZluVqDA/Z07Hrule8MK7Z9/0EoOEh2xvjl31cLheq65qyLDNlWT4CaHjI0Nkcq6r6E8fxzfd94fEEeMjQ2RxrmqYzxo7QWyBD5977Bcdse9huaoxSAAAAAElFTkSuQmCC") !important;
		}

		.staticStar.p3 {
			background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAABaklEQVQoz2NgwAFsbGwMQJiBHBAeHt4PwmRpbmlpuQ/CJGt0cXExWLZs2X8QBrFJ0pyTk9O/a9eu/yAMYuNUuNbQ3OGKoQUKnjp16v3jx4//B2EQ283NzQEdgAOzW9/o/HZdo/+XdRB427Zt/y9cuADGIPbkyZP/A/0Pxs3Nzf8LCgrOAzXLg22v0TXoX6al9/+cms7/S0B87ty5/1evXgVjEPvw4cP/9+3bB/bG9OnTMb2RqqvvP19d8/1FRdX/165dQ8EgQ4CueA/U6I/T/+1qGvYXpOUxNJ8/f/5/U1OTPd5Q3i0l039eTBJD89GjR/83NDTgTzDnBIXPAzHYmZcvX74PwiA2KNT7+/vP49SYpK6ucJKH9/9iMfH/u3fv7g8KCuIHYRD7zJkz/1euXPnf3t5eAavmqRKS+RMlpd6nqKlhBMqUKVP8N2zY8D4uLi4fq+ZSRcV6BwMDfmNjY1xJlj8zM7MeWQwAhBL+K9l+SwUAAAAASUVORK5CYII=") !important;
		}

		.staticStar.p6 {
			background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAABR0lEQVQoz2NgwAFsbGzAmCxwytWvH4SNjY0ZQJgkcN3R+z4Ik6y5wdza4JqN638QBrFJ0nzczLb/qpndfxAGsXFqXmto7nDF0AId3wfi/1AMYjugA2BgGjB06xud365r9P+yDn7c0tICxs3Nzf8LCgrOAzXLg22v0TXoX6al9/+cms7/Szjwvn37/u/atev/9OnT+zGcn6qr7z9fXfP9RUXV/9jwhQsX3gM1+uMMqHY1DfsL0vL/seGmpiZ7vKG8W0qm/7yY5H8QPi4uBcYwfkNDQz9ezecEhc8D8f/N4pL/++UV7oMwiA0S6+/vP49TY5K6usJJHt7/i8XE/1cpKvY7GBjwgzCIDRJbuXLlf3t7ewWsmqdKSOZPlJR6n6KmhhIooAQCEtuwYcP7uLi4fKyaSxUV60E2oYvD0raLiwt/ZmZmPbIcALuzziYfrXcdAAAAAElFTkSuQmCC") !important;
		}

		.staticStar.p10 {
			background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAPCAYAAAA71pVKAAABIUlEQVQoz2NgwAEa7V0MQBhd3NjYGI5xglOufv0gTJbm647e90GYZM0N5tYG12xc/4MwiE2S5uNmtv1Xzez+gzCIjVPzWkNzhyuGFuj4PhD/h+L76PIgPbFGJgYM3fpG57frGv2/rEMcBqkF6fE1MpYHO6VG16B/mZbe/3NqOv8v4cAgOZAakFoMP6fq6vvPV9d8f1FR9T82DJIDqcEZYO1qGvYXpOX/Y8MgObyhvVtKpv+8mOR/ED4uLgXGMD5IDq/mc4LC54H4/2Zxyf/98gr3QRjEBomB5HBqTlJXVzjJw/t/sZj4/ypFxX4HAwN+EAaxQWIgOZAarJqnSkjmT5SUep+ipuaPnmhAYiA5kBqsmksVFetBNuFK6yA5kBpkzQAvHdWbf69jygAAAABJRU5ErkJggg==") !important;
		}`;
		const styleElement = document.createElement('style');
		styleElement.textContent = styles;
		htmlElement.appendChild(styleElement);
	} catch (error) {
		logex(applyStyle, "Error applying styles to element" + error);
	}
}

/**
 * Get book reviews from ASIN number and show rating
 * last = boolean. Checks if is the last recursive pass
 */
function retrieveBookInfo(asin, last) {
	var uid = uuidv4();

	var urlGoodreads = ogUrl ?? "https://www.goodreads.com/book/isbn?isbn=" + asin;
	log("Retrieving goodreads info from url: " + urlGoodreads, uid);
	baseAPI.runtime.sendMessage({
		contentScriptQuery: "fetchHtml",
		url: urlGoodreads
	}, data => {
		try {

			let doc = parser.parseFromString(data, "text/html");
			// log(data);
			// GET RATINGS INFO
			let meta = doc.querySelectorAll("#bookMeta");

			if (!meta || meta.length === 0) {
				log("bookMeta not found, searching for .BookPageMetadataSection__ratingStats", uid);
				meta = doc.querySelectorAll(".BookPageMetadataSection__ratingStats");

				if (!meta || meta.length === 0) {
					log(".BookPageMetadataSection__ratingStats not found, searching for .BookPageMetadataSection", uid);
					meta = doc.querySelectorAll(".BookPageMetadataSection");
				}
			}

			log("End of info retrieval. Found " + meta.length + " nodes", uid);
			log("Meta selector values: " + meta.values, uid);

			for (let i = 0, element;
				(element = meta[i]); i++) {
				log(element, uid);
			}
			processResponse(asin, meta, urlGoodreads, last, uid);
		} catch (error) {
			logex(uid + " ::: retrieveBookInfo", error);
			isBusy = false;
		}
	});
}

function findStarRatingTag(element = document) {
	// First, check if the element contains the adbl-star-rating tag
	const productMetadata = element.querySelector("adbl-star-rating");

	// If the tag is found, return it
	if (productMetadata) {
		return productMetadata;
	}

	// If the element has a shadow root, search inside it recursively
	const shadowRoots = element.shadowRoot ? [element.shadowRoot] : [];

	// Also look for shadow roots in any child elements
	element.querySelectorAll("*").forEach(child => {
		if (child.shadowRoot) {
			shadowRoots.push(child.shadowRoot);
		}
	});

	// Recursively search all shadow roots
	for (let shadowRoot of shadowRoots) {
		const foundInShadow = findStarRatingTag(shadowRoot);
		if (foundInShadow) {
			return foundInShadow;
		}
	}

	// If not found in this element or any shadow roots, return null
	return null;
}

function AppendToAudible(contentSpan) {
	if (finished) return;
	log("AppendToAudible");

	const ratingsLabel = findStarRatingTag();

	if (ratingsLabel) {
		console.log("Found adbl-star-rating:", ratingsLabel);
		const parentUl = ratingsLabel.parentNode;
		applyStyle(parentUl);
		// Insert contentSpan after ratingsLabel
		const nextSibling = ratingsLabel.nextSibling;
		if (nextSibling) {
			parentUl.insertBefore(contentSpan, nextSibling);  // Insert before the next sibling
		} else {
			// If there's no next sibling, append it at the end
			parentUl.appendChild(contentSpan);
		}

		finished = true;
	} else {
		console.log("adbl-star-rating not found");
	}
}
/**
 * Appends ratings to Amazon page
 */
function AppendToAmazon(contentSpan, uid) {
	if (finished) return;
	log("AppendToAmazon", uid);
	// APPEND TO AMAZON PAGE
	// Get reviews section
	// NOTE: Amazon is a mess, usually #averageCusomerReviews exists, but sometimes it won't use it
	// and put the reviews link into #cmrsSummary-popover
	var amazonReview = document.querySelectorAll("#cmrs-atf, #acrCustomerReviewLink, #averageCustomerReviews");
	if (amazonReview.length === 0) {
		amazonReview = document.querySelectorAll("#centerAttributesColumns");
	}
	if (amazonReview.length !== 0) {
		amazonReview = amazonReview[0];
		log("Selected node amazonReview: " + amazonReview.id, uid);
		if (amazonReview.id === 'centerAttributesColumns') {
			var leftChild = amazonReview.children[0];
			if (leftChild) {
				amazonReview = leftChild;
			}
		}
		else {
			amazonReview = amazonReview.parentNode;
		}
		log("amazonReview: " + amazonReview, uid);
	} else {
		log("GoodreadsForAmazon: #cmrs-atf or #acrCustomerReviewLink not found. Trying with #averageCusomerReviews", uid);
		amazonReview = document.querySelectorAll("#averageCustomerReviews");
	}
	// If not found is not .com and uses different html ¬¬
	if (amazonReview.length === 0) {
		var amazonReview = document.querySelectorAll(".buying .crAvgStars");
		// No crAvgStars, search .buying inside .buying (yes, wtf)
		if (amazonReview.length === 0) {
			log("GoodreadsForAmazon: .crAvgStars not found. Trying with .buying", uid);
			// Here we go... holy shit Amazon, please define the different parts of your pages properly
			amazonReview = document.querySelectorAll(".buying .tiny a");
			if (amazonReview.length !== 0) {
				amazonReview = amazonReview[0].parentNode
			}
			// else: just append
		}
	}
	if (amazonReview[0] !== undefined) {
		log("Get first node of amazonReview", uid);
		amazonReview = amazonReview[0];
	}
	// Append to reviews
	log("Append contentSpan", uid);
	amazonReview.appendChild(contentSpan);

	// Display or hide amazon's own goodreads node
	ShowOrHideAmazonsDisplayGoodreads();

	finished = true;
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
	log("checkIfBook attempt " + checkInterval);
	// Audible
	if (isAudibleCom) return AUDIBLE_PATTERN.test(window.location.href);
	// Amazon
	var bookDetectionIdArray = ["ebooksImageBlockOuter", "booksTitle", "bookEdition",
		"pBookUpsellBorrowButton", "booksImageBlock_feature_div",
		"pbooksReadSampleButton-announce", "rpi-attribute-book_details-fiona_pages",
		"rpi-attribute-book_details-customer_recommended_age", "rpi-attribute-book_details-isbn13",
		"bookslegalcompliancebanner_feature_div"];
	return SelectById(bookDetectionIdArray) !== null;
}

function ShowOrHideAmazonsDisplayGoodreads() {
	log("Display Amazon's own Goodreads rating? " + displayAmazonGoodreads);
	try {
		if (!displayAmazonGoodreads) {
			let grCount = document.getElementsByClassName('gr-review-base')[0];
			if (grCount) {
				let papa = grCount.parentNode;
				papa.removeChild(grCount);
			}
		}
	} catch (error) {
		log(error);
	}
}

/**
 * STARTING POINT
 */

var isBookChecker = window.setInterval(function () {
	if (checkInterval > MAX_BOOK_CHECK_TRIES) {
		window.clearInterval(isBookChecker);
		return;
	}
	checkInterval++;
	// Check if the domain is Amazon or Audible
	isAudibleCom = AUDIBLE_PATTERN.test(window.location.href);
	log("isAudibleCom = " + isAudibleCom);
	if (checkIfBook()) {
		window.clearInterval(isBookChecker);
		log("Is book page");

		// Load storage options
		var options = {};
		options.displayAmazonGoodreads = false;
		baseAPI.storage.local.get(options, function (items) {
			displayAmazonGoodreads = items.displayAmazonGoodreads;
		});
		var asinList = [];
		// Try to retrieve info about the book from the asin codes found
		var metaInfoChecker = window.setInterval(function () {
			checkInterval++;
			if (checkInterval > MAX_BOOK_CHECK_TRIES) {
				window.clearInterval(metaInfoChecker);
				return;
			}

			if (isBusy) {
				log("Still busy, wait...");
				return;
			}

			asinCheckedList = [];

			goodreadsRetrieveInternal++;
			log("Interval number " + goodreadsRetrieveInternal);

			if (!asinList || asinList.length === 0) {
				log("No ASIN found, searching");
				asinList = getASIN();
			}
			if (asinList && asinList.length > 0) {
				log("Finished: " + finished + ", goodreadsRetrieveInternal: " + goodreadsRetrieveInternal);
				if (finished || goodreadsRetrieveInternal > 20) {
					log("asin length is " + asinList.length + ", finished = " + finished);
					window.clearInterval(metaInfoChecker);
				} else {
					log("Not finished yet, continue retrieving book info");
					for (let index = 0; index < asinList.length; index++) {
						let currentAsin = asinList[index];
						// Search in checked asin list
						let found = asinCheckedList.includes(currentAsin);
						// if found: continue with next
						// if not found: add to list and process
						if (found === false) {
							asinCheckedList.push(currentAsin);
							log("Retrieving book info for asin/isbn number: " + currentAsin);
							isBusy = true;
							retrieveBookInfo(currentAsin, false);
							break;
						}
						else {
							log('ASIN ' + currentAsin + ' already processed, continue');
						}
					}
				}
			}
			else {
				log("No ASIN found");
			}
		}, BOOKINFO_RETRIEVE_INTERVAL);

	} else {
		log("Is NOT book page");
	}
}, BOOKINFO_RETRIEVE_INTERVAL);