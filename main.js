(function() {
  var checkLoginStatus, currentIcon, deleteMessages, deletedIds, displayError, folderId, getDeviations, loadingIconSeq, maxMessages, n, newMessages, originalIcon, refresh, refreshTimer, rotateIcon, setIcon, setLoggedIn, setLoggedOut, state, updateDisplay, updateFolderId, updateOptions, waitForLoaded;
  var __indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (this[i] === item) return i;
    }
    return -1;
  };
  state = 'idle';
  folderId = null;
  newMessages = [];
  deletedIds = [];
  originalIcon = "icons/icon.png";
  loadingIconSeq = (function() {
    var _results;
    _results = [];
    for (n = 0; n <= 7; n++) {
      _results.push("icons/ajax-loader-" + n + ".png");
    }
    return _results;
  })();
  currentIcon = originalIcon;
  setIcon = function(path) {
    currentIcon = path;
    return chrome.browserAction.setIcon({
      path: path
    });
  };
  rotateIcon = function() {
    var icon;
    if (state !== 'loading') {
      return;
    }
    icon = loadingIconSeq[loadingIconSeq.indexOf(currentIcon) + 1];
    if (!(icon != null)) {
      icon = loadingIconSeq[0];
    }
    setIcon(icon);
    return setTimeout(rotateIcon, 100);
  };
  $(document).ajaxStart(function() {
    console.log("Ajax start!");
    state = 'loading';
    chrome.browserAction.setBadgeText({
      text: ''
    });
    return rotateIcon();
  });
  $(document).ajaxStop(function() {
    console.log("Ajax stop!");
    state = 'idle';
    return setIcon(originalIcon);
  });
  $(document).ajaxError(function(event) {
    console.log("Ajax error!");
    console.log(event);
    state = 'error';
    setIcon(originalIcon);
    return displayError("Error connecting to deviantART!");
  });
  updateFolderId = function(callback) {
    console.log("Updating folder ID...");
    return $.get("http://my.deviantart.com/messages/#view=deviations", function(data) {
      var match;
      match = data.match(/aggid.+?(\d+)/);
      if (!(match != null)) {
        if (data.match(/Deviant Login/)) {
          return setLoggedOut();
        } else {
          console.log(data);
          return displayError("Unable to find deviantWATCH folder ID.");
        }
      } else {
        folderId = match[1];
        console.log("Folder ID updated!");
        if (callback != null) {
          return callback(folderId);
        }
      }
    });
  };
  deleteMessages = function(msgIds, callback) {
    return chrome.cookies.get({
      url: "http://my.deviantart.com/",
      name: "userinfo"
    }, function(cookie) {
      var call, data, msgId;
      call = '"MessageCenter","trash_messages",';
      call += ((function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = msgIds.length; _i < _len; _i++) {
          msgId = msgIds[_i];
          _results.push("[" + folderId + ",\"id:devwatch:" + msgId + "\"]");
        }
        return _results;
      })()).join();
      data = {
        ui: decodeURIComponent(cookie.value),
        "c[]": call,
        t: 'json'
      };
      console.log("Deleting messages...");
      return $.post("http://my.deviantart.com/global/difi/?", data, function(resp) {
        deletedIds = deletedIds.concat(msgIds);
        if (callback != null) {
          return callback();
        }
      });
    });
  };
  displayError = function(err) {
    console.log(err);
    chrome.browserAction.setBadgeText({
      text: 'err'
    });
    return chrome.browserAction.setTitle({
      title: err
    });
  };
  maxMessages = 101;
  getDeviations = function(callback) {
    var hits, message_url;
    message_url = 'http://my.deviantart.com/global/difi/?' + encodeURI('c[]="MessageCenter","get_views",[' + folderId + ',"oq:devwatch:0:' + maxMessages + ':f:tg=deviations"]') + '&t=json';
    hits = [];
    console.log("Retrieving deviations...");
    return $.get(message_url, function(data) {
      var obj;
      window.data = data;
      obj = JSON.parse(data);
      if (obj.DiFi.status === "FAIL") {
        return setLoggedOut();
      } else {
        try {
          obj.DiFi.response.calls[0].response.content[0].result.hits.forEach(function(hit) {
            return hits.push(hit);
          });
        } catch (err) {
          console.log(err);
          displayError("Error parsing response from deviantART.");
        }
        console.log("Deviations retrieved!");
        return callback(hits);
      }
    });
  };
  updateDisplay = function() {
    var num, numDesc;
    if (newMessages.length === 0) {
      chrome.browserAction.setBadgeText({
        text: ""
      });
      return chrome.browserAction.setTitle({
        title: "No new deviations"
      });
    } else {
      num = newMessages.length;
      numDesc = num === maxMessages ? ">" + (num - 1) : "" + num;
      chrome.browserAction.setBadgeText({
        text: numDesc
      });
      return chrome.browserAction.setTitle({
        title: "" + numDesc + " new deviation" + (num > 1 ? 's' : '')
      });
    }
  };
  refreshTimer = null;
  refresh = function() {
    var fetch;
    if (refreshTimer != null) {
      clearTimeout(refreshTimer);
    }
    if (state !== 'needlogin') {
      fetch = function() {
        return getDeviations(function(hits) {
          var hit, _i, _len, _ref;
          newMessages = [];
          for (_i = 0, _len = hits.length; _i < _len; _i++) {
            hit = hits[_i];
            if (_ref = hit.msgid, __indexOf.call(deletedIds, _ref) < 0) {
              newMessages.push(hit);
            }
          }
          return updateDisplay();
        });
      };
      if (!(folderId != null)) {
        updateFolderId(fetch);
      } else {
        fetch();
      }
    } else {
      checkLoginStatus();
    }
    return refreshTimer = setTimeout(refresh, Store.get('updateInterval'));
  };
  waitForLoaded = function(tabId, callback) {
    var repeater, timer;
    timer = null;
    repeater = function() {
      return chrome.tabs.get(tabId, function(tab) {
        if (tab.status === 'complete') {
          clearTimeout(timer);
          return callback();
        } else {
          return timer = setTimeout(repeater, 500);
        }
      });
    };
    return repeater();
  };
  setLoggedOut = function() {
    console.log("Login required!");
    state = 'needlogin';
    folderId = null;
    chrome.browserAction.setBadgeText({
      text: "login"
    });
    return chrome.browserAction.setTitle({
      title: "Please log in to deviantART."
    });
  };
  setLoggedIn = function() {
    folderId = null;
    state = 'idle';
    return refresh();
  };
  checkLoginStatus = function() {
    return chrome.cookies.get({
      url: "http://my.deviantart.com/",
      name: "userinfo"
    }, function(cookie) {
      var ui;
      ui = $.parseJSON(decodeURIComponent(cookie.value).split(";")[1]);
      if (ui.username === "" && state !== 'needlogin') {
        return setLoggedOut();
      } else if (ui.username !== "" && state === 'needlogin') {
        return setLoggedIn();
      }
    });
  };
  chrome.cookies.onChanged.addListener(function(changeInfo) {
    if (changeInfo.cookie.domain === ".deviantart.com" && changeInfo.cookie.name === "userinfo") {
      return checkLoginStatus();
    }
  });
  chrome.browserAction.onClicked.addListener(function(tab) {
    var max, message, _i, _len, _ref;
    if (state === 'loading') {
      console.log("Loading...");
    } else if (state === 'needlogin') {
      return chrome.tabs.create({
        url: "http://www.deviantart.com/users/login"
      });
    } else if (newMessages.length === 0) {
      return refresh();
    } else {
      max = Store.get('maxTabs');
      _ref = newMessages.slice(0, (max - 1 + 1) || 9e9);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        message = _ref[_i];
        chrome.tabs.create({
          url: message.url
        });
      }
      deleteMessages((function() {
        var _j, _len2, _ref2, _results;
        _ref2 = newMessages.slice(0, (max - 1 + 1) || 9e9);
        _results = [];
        for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
          message = _ref2[_j];
          _results.push(message.msgid);
        }
        return _results;
      })(), refresh);
      return newMessages = newMessages.slice(max);
    }
  });
  Store.setDefault('updateInterval', 10 * 60 * 1000);
  Store.setDefault('maxTabs', 20);
  setLoggedOut();
  checkLoginStatus();
  updateOptions = function() {
    clearTimeout(refreshTimer);
    return refreshTimer = setTimeout(refresh, Store.get('updateInterval'));
  };
  window.refresh = refresh;
  window.updateOptions = updateOptions;
}).call(this);
