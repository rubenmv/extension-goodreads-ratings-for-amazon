# Goodreads ratings for Amazon

**Goodreads ratings for Amazon** is a small extension that shows Goodreads ratings in Amazon pages. It also provides with a link to directly visit the Goodreads page.

Works with most Amazon domains.

## LEGAL STUFF
**Goodreads ratings for Amazon** by **[Rub&eacute;n Mart&iacute;nez](https://twitter.com/rub3nmv)** is licensed as Apache 2.0.  
For bugs report send me an email at
rub3nmv@gmail.com
or visit the github project page at 
https://github.com/rubenmv/extension-goodreads-ratings-for-amazon


# Version History

2.0.5 - 2023.07.23
- Improved data extraction from Goodreads.

2.0.4 - 2023.07.22
- Checks if the page is a book listing every 1 seconds until found or reaches max attempts.

2.0.3 - 2023.07.08
- Fixes various problems.
- Adds options page.
- Adds option to always display Amazon's version of Goodreads ratings (as of now, only Amazon.com).

2.0.2 - 2023.06.18
- Improved logs and data retrieve.

2.0.1 - 2023.01.15
- Fixes problem with stars due to changes in Goodreads.

1.9.1 - 2022.08.13
- Quick fix for Chrome and other browsers using new Goodreads style.

1.8.0 - 2021.07.16
- Fixes ASIN retrieval for method 3.
- Corrections in documentation and support for more Amazon domains, thanks to https://github.com/dtsdwarak.

1.7.5 - 2020.08.30
- Fixes ASIN retrieval in some pages.

1.7.4 - 2020.04.23
- Improved detection for book product pages.

1.7.3 - 2019.11.15
- Adds a new method for obtaining the correct ISBN/ASIN for Audible.com.
- Improved ISBN/ASIN number detection.

1.7.2 - 2019.03.26
- Fixes problem with CORB on newest Chrome versions.

1.7.0 - 2018.12.27
- Adds support for audible.com domains. Works only if audio book version si registered in Goodreads.

1.6.3 - 2018.12.01
- Fixed: the extension wasn't working due to a change in the Goodreads site code.

1.6.2 - 2018.09.18
- Added more methods for searching for the isbn.
- Added support for new Amazon layout.

1.6.1 - 2017.11.16
- New icon design.
- Replaces innerHTML with DOM Parser.

1.6 - 2017.11.14
- Replaces JQuery dependency with native javascript.

1.5.5 - 2017.09.24
- Fixes alignment on some pages.

1.5.4 - 2017.09.21
- Restores average rating text.

1.5.3 - 2017.09.18
- Updated jquery library

1.5.2 - 2017.09.17
- Improved security when retrieving Goodreads information.
- Fixes wrong links when book is not found or item is not book.
- General cleanup.

1.5.1 - 2017.09.01
- Search book information with both ISBN-10 and ISBN-13 to ensure the book is found in Goodreads.
- Fixed minor problems with alignment and extra spaces.

1.5 - 2017.08.30
- Added support for Amazon Smile domains.
- Removed textual rating and improved alignment.
- Firefox: migrated from old Addons SDK to Web Extensions.

1.4.1 - 2015.10.26
- Small update to fix a small mistake.

1.4 - 2015.10.26
- Replaces innerHTML with JQuery .find directly into the string to get the book info.

1.3 - 2015.10.16
- Bug Fix. Amazon.com did some changes in the code, ASIN was not found, fixed.
- Bug Fix. Some non amazon.com pages show the rating in the suggestions section by the wrong book. Improved class specificity when selecting the correct tag.
- Huge speed improvement when retrieving book info. Now it won't wait for the whole page to finish loading.
 
1.2 - 2015.10.14
- Bug Fix. Don't show anything when book is not found.
- Removes unnecessary content policies from manifest. 

1.1 - 2015.10.13
- Bug Fix and manifest permissions. 

1.0 - 2015.10.13
- Shows stars from Goodreads.
- Shows numerical rating.
- Shows number of ratings.
- Links to Goodreads page.

