// background.js
// Copyright 2017 LinkedIn Corporation
// All Rights Reserved.
// Author: Joshua Levine

// 'active', daydiff.toString()]);          // unique number of users for the day (they opened their browser)
// 'clickedUnique', index]);                // unique badge clicks
// 'clicked', index]);                      // total badge clicks
// 'viewed', page]);                        // landing page for clicked badge
// 'badgedUnique', daydiff.toString()]);    // unique number of badge changes that day
// 'badgedAny', localStorage.badgeCount]);  // total badge increases
// 'badgedNewUnique', daydiff.toString()]); // unique number of badge increases from 0 to x
// 'badged', localStorage.badgeCount]);     // total number of badge increases from 0 to x

var requestTimerId = 0;
var badgeFade = 0;
var defaultPage = "feed";
var notifyPage = "notifications";
var messagePage = "messaging";
var networkPage = "mynetwork";

var notifications = "NOTIFICATIONS";
var messaging = "MESSAGING";
var network = "MY_NETWORK";

var liURL = "https://www.linkedin.com/";
var deepLink = ""; //"m/";
var transformMap = {'feed' : "", 'notifications' : notifications, 'messaging' : messaging, 'mynetwork' : network};
var badgeURL = liURL + "voyager/api/voyagerCommunicationsTabBadges?q=tabBadges&countFrom=0";
var trackURL = liURL + "li/track";

var pageInstance = "d_linotify_click";
var pageInstanceBadge = "-badge-";
var pageBadgeInfo = [ "0", "1", "2", "3-4", "3-4", "5-7", "5-7", "5-7", "8-99" ];
var pageUrnParam = "lipi=urn%3Ali%3Apage%3A";
var controlUrnParam = "licu=urn%3Ali%3Acontrol%3A";

var analyticsCode = "UA-62256447-10";

function getLIPage() {
  var returnPage;
  // Pick the best page based on the highest badge count
  if(!localStorage.hasOwnProperty('badgeCount') || localStorage.badgeCount <= 0) {
    returnPage = defaultPage;
  }
  else if(localStorage[messaging] >= localStorage[notifications] && localStorage[messaging] >= localStorage[network]) {
    returnPage = messagePage;
  }
  else if(localStorage[notifications] >= localStorage[messaging] && localStorage[notifications] >= localStorage[network]) {
    returnPage = notifyPage;
  }
  else {
    returnPage = networkPage;
  }
  return returnPage;
}

// UUID v4
function generateUuid()
{
    var uuid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var randVal = Math.random() * 16 | 0;
        var val = c == 'x' ? randVal : (randVal & 0x3 | 0x8);
        return val.toString(16);
    });
    return uuid;
}

function getLIUrl(page) {
  var index = localStorage.badgeCount;

  var currentDate = new Date().toISOString().substring(0, 10);
  // clickedUnique records unique clicks for the day
  if(localStorage.hasOwnProperty('lastClickTimeAny') && currentDate != localStorage.lastClickTimeAny) {
    var daydiff = datediff(currentDate, localStorage.lastClickTimeAny);
    console.log('New day click: ' + daydiff.toString() + ' ' + currentDate + ' ' + localStorage.lastClickTimeAny);
    ga('send', 'event', 'clickedUnique', daydiff.toString());
    localStorage.lastClickTimeAny = currentDate;
  } else if(!localStorage.hasOwnProperty('lastClickTimeAny')) {
    ga('send', 'event', 'clickedUnique', '0');
    localStorage.lastClickTimeAny = currentDate;
  }

  ga('send', 'event', 'clicked', index);
  ga('send', 'event', 'viewed', page);

  var binaryStr = '';
  if(index < 0)
    index = 0;
  // Cap at 8 badges
  else if(index > 8)
    index = 8;
  var uuid = generateUuid();
  //console.log(uuid);
  // Convert chars into a byte of data (two letters at a time)
  // Example:  "f3" -> 243
  for(var i = 0; i < uuid.length; i += 2) {
    //console.log(parseInt(uuid.substring(i, i+2), 16));
    binaryStr += String.fromCharCode( parseInt(uuid.substring(i, i+2), 16) );
  }
  // NOTE: Force all pages to feed, will A/B test this later
  page = defaultPage;

  return liURL + deepLink + page + "/" + "?" + pageUrnParam + pageInstance + "%3B" + encodeURIComponent(window.btoa(binaryStr))
               + "&" + controlUrnParam + pageInstance + pageInstanceBadge + pageBadgeInfo[index];
}

// Convert date string to Date
function dstrToUTC(ds) {
 // yyyy-mm-dd format
 var dsarr = ds.split("-");
 var mm = parseInt(dsarr[1],10);
 var dd = parseInt(dsarr[2],10);
 var yy = parseInt(dsarr[0],10);
 return Date.UTC(yy,mm-1,dd,0,0,0);
}

// Days between two dates
function datediff(ds1,ds2) {
 if(ds1 === undefined || ds2 === undefined)
  return 0;
 var d1 = dstrToUTC(ds1);
 var d2 = dstrToUTC(ds2);
 var oneday = 86400000;
 return (d1 - d2) / oneday;
}

function isLIUrl(url) {
  return url.startsWith(liURL);
}

function animateBadge() {
    if(localStorage.animateBadge == 1) {
      badgeFade = 205;
      chrome.browserAction.setBadgeBackgroundColor({color:[255, badgeFade + 44, badgeFade + 50, 255]});
    }
    else {
      badgeFade = 0;
      //chrome.browserAction.setBadgeBackgroundColor({color:[205, 0, 25, 255]});
      chrome.browserAction.setBadgeBackgroundColor({color:[255, 44, 51, 255]});
    }
    fadeInBadge();
    function fadeInBadge() {
        setTimeout(function () {
            if(localStorage.animateBadge % 2 == 1)
              badgeFade -= 5;
            else
              badgeFade += 5;
            if (badgeFade <= 0 || badgeFade >= 205) {
              localStorage.animateBadge++;
              if(localStorage.animateBadge >= 6) {
                chrome.browserAction.setBadgeBackgroundColor({color:[255, 44, 51, 255]});
                localStorage.animateBadge = 0;
                return;
              }
            }

            chrome.browserAction.setBadgeBackgroundColor({color:[255, badgeFade + 44, badgeFade + 50, 255]});
            fadeInBadge();
        }, 10);
    }
}

function updateIcon() {
  if (!localStorage.hasOwnProperty('badgeCount') || localStorage.badgeCount == -1) {
    //chrome.browserAction.setIcon({path:"li-icon.png"});
    chrome.browserAction.setBadgeBackgroundColor({color:[150, 150, 150, 230]});
    chrome.browserAction.setBadgeText({text:"?"});
    chrome.browserAction.setTitle({ title: 'Please click here to login into LinkedIn.' });
  } else {
    //chrome.browserAction.setIcon({path: "li-icon.png"});
    if(localStorage.animateBadge > 0) {
      animateBadge();
    } else {
      chrome.browserAction.setBadgeBackgroundColor({color:[255, 44, 51, 255]});
    }
    var displayCount = localStorage.badgeCount;
    if(isNaN(displayCount) || displayCount == "0") {
      displayCount = "";
    }
    chrome.browserAction.setBadgeText({
      text: displayCount
    });
    if(localStorage.badgeCount > 0) {
      chrome.browserAction.setTitle({
        title: 'My Network: ' + localStorage[network] + ' Messages: ' + localStorage[messaging] + ' Notifications: ' + localStorage[notifications]
      });
    } else {
      chrome.browserAction.setTitle({ title: 'You have no new LinkedIn activity.' });
    }
  }
}

function getBadgeCount() {
  if (!localStorage.hasOwnProperty('csrfToken')) {
    localStorage.invalidLogin = 1;
    console.log('no token')
    updateBadgeCount();
    return;
  }
  localStorage.invalidLogin = 0;
  var xhr = new XMLHttpRequest();
  xhr.open("GET", badgeURL, true);
  xhr.setRequestHeader("csrf-token", localStorage.csrfToken);
  xhr.setRequestHeader("X-RestLi-Protocol-Version", "2.0.0");
  xhr.onreadystatechange = function() {
      //console.log(xhr);
      if (xhr.readyState == 4) {
        if(xhr.status != 200) {
          console.log("Status: " + xhr.status);
        }
        localStorage.lastStatus = xhr.status;
        if(xhr.status == 200) {
          var result = xhr.responseText;
          var jsonresult = JSON.parse(result);
          for (var i = 0; i < jsonresult.elements.length; i++) {
            // Need to wait 2 minutes before network badge returns correct data so skip this round
            if(localStorage.ignoreNetwork == 1 && jsonresult.elements[i].tab == network) {
              localStorage.ignoreNetwork = 0;
            } else {
              localStorage[jsonresult.elements[i].tab] = jsonresult.elements[i].count;
            }
          }
        } else if (xhr.status == 0 || xhr.status == 500) {
          // Internet is down, do nothing
        } else {
          // Failure, invalid token?
          localStorage.invalidLogin = 1;
        }
        updateBadgeCount();
      }
  };
  xhr.send();
}

function goToUrl() {
  console.log('Going to url...');
  var liPage = getLIPage();
  var goUrl = getLIUrl(liPage);
  //console.log(goUrl);

  localStorage.lastTime = Date.now();
  chrome.tabs.create({url: goUrl}, function(tab) {
    console.log('Tab Created');
  });

  // NOTE: Force all pages to feed, will A/B test this later
  liPage = defaultPage;
  resetBadge(transformMap[liPage]);
}

function updateBadgeCount() {
  localStorage.animateBadge = 0;
  if (localStorage.hasOwnProperty('invalidLogin') && localStorage.invalidLogin == 1) {
    localStorage.badgeCount = -1;
    console.log('Badge count = ' + localStorage.badgeCount);
  } else {
    var prevBadge = localStorage.badgeCount;
    localStorage.badgeCount = +localStorage[messaging] + +localStorage[notifications] + +localStorage[network];
    if (localStorage.badgeCount > 0) {
      console.log('Badge count = ' + localStorage.badgeCount + ' [' + localStorage[messaging] + ', ' +
        localStorage[notifications] + ', ' + localStorage[network] + ']');
    }
    if(prevBadge < localStorage.badgeCount && localStorage.badgeCount > 0) {
      var currentDate = new Date().toISOString().substring(0, 10);
      // badgedUniqueAny records any unique badge increase for the day
      if(localStorage.hasOwnProperty('lastBadgeTimeAny') && currentDate != localStorage.lastBadgeTimeAny) {
        var daydiff = datediff(currentDate, localStorage.lastBadgeTimeAny);
        console.log('New day badge2: ' + daydiff.toString() + ' ' + currentDate + ' ' + localStorage.lastBadgeTimeAny);
        ga('send', 'event', 'badgedUnique', daydiff.toString());
        localStorage.lastBadgeTimeAny = currentDate;
      } else if(!localStorage.hasOwnProperty('lastBadgeTimeAny')) {
        ga('send', 'event', 'badgedUnique', '0');
        localStorage.lastBadgeTimeAny = currentDate;
      }
      ga('send', 'event', 'badgedAny', localStorage.badgeCount);

      if(prevBadge == 0) {
        ga('send', 'event', 'badged', localStorage.badgeCount);
        // badgedNewUnique only records if they went from 0 -> x badge per day.
        // This won't trigger if they had x -> y badge increase from yesterday.
        if(localStorage.hasOwnProperty('lastBadgeTime') && currentDate != localStorage.lastBadgeTime) {
          var daydiff = datediff(currentDate, localStorage.lastBadgeTime);
          console.log('New day badge: ' + daydiff.toString() + ' ' + currentDate + ' ' + localStorage.lastBadgeTime);
          ga('send', 'event', 'badgedNewUnique', daydiff.toString());
          localStorage.lastBadgeTime = currentDate;
        } else if(!localStorage.hasOwnProperty('lastBadgeTime')) {
          ga('send', 'event', 'badgedNewUnique', '0');
          localStorage.lastBadgeTime = currentDate;
        }
        // Start with fade in
        localStorage.animateBadge = 1;
      }
      else
        // Start with fade out
        localStorage.animateBadge = 2;
    }
  }
  updateIcon();
  scheduleRequest();
}

function resetBadge(key) {
  if(key == "")
    return;
  if(!localStorage.hasOwnProperty('badgeCount') ||
      localStorage.badgeCount == -1)
    return;

  //console.log('resetBadge ' + key);
  // Works around a bug where network badge is slow to reset from the API side
  if(key == network && localStorage[network] > 0) {
    console.log('network work around');
    localStorage.ignoreNetwork = 1;
  }
  localStorage[key] = 0;
  localStorage.badgeCount = +localStorage[messaging] + +localStorage[notifications] + +localStorage[network];
  updateIcon();
  stopRequest();
  scheduleRequest();
}

function startRequest() {
  getBadgeCount();
}

function scheduleRequest() {
  var currentDate = new Date().toISOString().substring(0, 10);
  var currentTime = Date.now();

  if(localStorage.hasOwnProperty('lastActiveTime') && currentDate != localStorage.lastActiveTime) {
    var daydiff = datediff(currentDate, localStorage.lastActiveTime);
    console.log('New day: ' + daydiff.toString() + ' ' + currentDate + ' ' + localStorage.lastActiveTime);
    ga('send', 'pageview', location.pathname);
    ga('send', 'event', 'active', daydiff.toString());
    localStorage.lastActiveTime = currentDate;
    localStorage.lastRefreshTime = currentTime;
    if(localStorage.hasOwnProperty('lastActiveWeekTime') && currentDate != localStorage.lastActiveWeekTime) {
      var daydiffWeek = datediff(currentDate, localStorage.lastActiveWeekTime);
      if(daydiffWeek >= 7) {
        ga('send', 'event', 'activeWeek', Math.floor(daydiffWeek / 7));
        localStorage.lastActiveWeekTime = currentDate;
      }
    } else if(!localStorage.hasOwnProperty('lastActiveWeekTime')) {
      ga('send', 'event', 'activeWeek', '0');
      localStorage.lastActiveWeekTime = currentDate;
    }
  }
  // Refresh session every 19 mins
  else if(currentTime - localStorage.lastRefreshTime > 1000*60*19) {
    // Disabled to reduce data volume
    //ga('send', 'pageview', location.pathname);
    localStorage.lastRefreshTime = currentTime;
  }

  // Poll less often for users that haven't clicked on the extension in 24 hours
  if(localStorage.hasOwnProperty('lastTime') && currentTime - localStorage.lastTime > 1000*60*60*24) {
    //console.log('Delta time: ' + ((currentTime - localStorage.lastTime) / 1000 / 60));
    delay = 10;
  } else if(localStorage.lastStatus == 0) {
    delay = 1;
  } else if(localStorage.badgeCount > 0) {
    delay = 3;
  } else if(localStorage.badgeCount == 0) {
    delay = 1;
  } else {
    // Try less often if user isn't logged in or network error
    delay = 5;
  }
  //console.log('Scheduling for: ' + delay + ' min');
  requestTimerId = window.setTimeout(startRequest, delay*60*1000);
}

function stopRequest() {
  if(requestTimerId != 0)
    clearTimeout(requestTimerId);
}

function initLoad() {
  // Standard Google Universal Analytics code
  (function(i,s,o,g,r,a,m) {
    i['GoogleAnalyticsObject']=r;i[r]=i[r]||function() {
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
  }) (window,document,'script','https://platform.linkedin.com/js/analytics.js','ga');

  ga('create', analyticsCode, 'auto');
  ga('set', 'checkProtocolTask', function(){}); // Removes failing protocol check
  ga('send', 'pageview');

  localStorage.lastRefreshTime = Date.now();

  if(!localStorage.hasOwnProperty('lastActiveTime')) {
    localStorage.lastActiveTime = new Date().toISOString().substring(0, 10);
    ga('send', 'event', 'active', '0');
    localStorage.lastActiveWeekTime = localStorage.lastActiveTime;
    ga('send', 'event', 'activeWeek', '0');
  }

  startRequest();
}

initLoad();

// Called when the user clicks on the browser action.
chrome.browserAction.onClicked.addListener(goToUrl);

chrome.runtime.onMessage.addListener(function (msg, sender) {
  // First, validate the message's structure
  if ((msg.from === 'content') && (msg.subject === 'tokenUpdate')) {
    console.log(msg.subject);
    // Only trigger an API call when token changes or badge is -1
    // Or when last status was zero (no internet)
    if(!localStorage.hasOwnProperty('csrfToken') || localStorage.csrfToken != msg.body ||
      (localStorage.hasOwnProperty('badgeCount') && localStorage.badgeCount == -1) ||
      (localStorage.hasOwnProperty('lastStatus') && localStorage.lastStatus == 0)) {
      console.log('Updating token');
      localStorage.csrfToken = msg.body;
      stopRequest();
      startRequest();
    }
  }
  else if ((msg.from === 'content') && (msg.subject === messaging ||
    msg.subject === notifications || msg.subject === network)) {
    console.log('Reset for ' + msg.subject);
    resetBadge(msg.subject);
  }
});

// Update as soon possible instead of waiting for browser restart
chrome.runtime.onUpdateAvailable.addListener(function (details) {
  console.log("updating to version " + details.version);
  chrome.runtime.reload();
});


