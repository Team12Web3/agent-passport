// content.js
// Copyright 2017 LinkedIn Corporation
// All Rights Reserved.
// Author: Joshua Levine

function readCookie(cookie, name) {
	var nameEQ = name + "=";
	var ca = cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') {
			c = c.substring(1,c.length);
		}
		if (c.indexOf(nameEQ) == 0) {
			return c.substring(nameEQ.length,c.length).replace(/"+/g, '');
		}
	}
	return null;
}

function readCsrf() {
	var cookie = readCookie(document.cookie, "JSESSIONID");
    if(cookie) {
    	//console.log("Got token");
    	chrome.runtime.sendMessage({
		  from:    'content',
		  subject: 'tokenUpdate',
		  body: cookie
		});
    }
};

// TODO: only get cookie once a day?
// TODO: check for invalid cookie (not logged in), incognito

function resetNotify() {
    console.log("resetNotify");
    chrome.runtime.sendMessage({
	  from:    'content',
	  subject: 'NOTIFICATIONS',
	  body: 0
	});
}

function resetMessaging() {
    console.log("resetMessaging");
    chrome.runtime.sendMessage({
	  from:    'content',
	  subject: 'MESSAGING',
	  body: 0
	});
}

function resetNetwork() {
    console.log("resetNetwork");
    chrome.runtime.sendMessage({
	  from:    'content',
	  subject: 'MY_NETWORK',
	  body: 0
	});
}

// Needed when leaving the login page to force token refresh
function checkFinishLogin() {
	if(window.location.href.indexOf("/login/") == -1) {
		readCsrf();
		return;
	}
	window.setTimeout(checkFinishLogin, 3000);
}

readCsrf();

// Used to reset the badge count when member clicks on the button to navigate to these pages instead of
// waiting the 1 minute for the API call to return the updated badge count.
try {
	document.querySelectorAll('[href="/notifications/"]')[1].addEventListener('click', resetNotify);
	document.querySelectorAll('[href="/messaging/"]')[1].addEventListener('click', resetMessaging);
	document.querySelectorAll('[href="/mynetwork/"]')[1].addEventListener('click', resetNetwork);
} catch(err) {

}

// Site will skip promo if user has extension installed
var isInstalledNode = document.createElement('div');
isInstalledNode.id = 'linkedin-extension-is-installed';
document.body.appendChild(isInstalledNode);

// DOM hasn't created the class yet, need to delay 1 sec
window.setTimeout(setupMessagePopupOnClick, 1000);

function setupMessagePopupOnClick() {
	var clickObj = document.querySelector('header.msg-overlay-bubble-header');
	if(clickObj != null) {
		clickObj.addEventListener('click', resetMessaging);
	}
	if(window.location.href.indexOf("/login/") != -1) {
		console.log(window.location);
		window.setTimeout(checkFinishLogin, 3000);
	}
}
