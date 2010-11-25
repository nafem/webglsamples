/*
 * Copyright 2009, Google Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */


/**
 * @fileoverview This file contains objects to sync app  settings across
 * browsers.
 */

tdl.provide('tdl.sync');

tdl.require('tdl.log');
tdl.require('tdl.io');

/**
 * A module for sync.
 * @namespace
 */
tdl.sync = tdl.sync || {};

/**
 * Manages synchronizing settings across browsers. Requires a server
 * running to support it. Note that even if you don't want to sync
 * across browsers you can still use the SyncManager.
 *
 * @constructor
 * @param {!Object} settings The object that contains the settings you
 *     want kept in sync.
 */
tdl.sync.SyncManager = function(settings) {
  this.settings = settings;
  this.putCount = 0;
  this.getCount = 0;

  // This probably should not be here.
  try {
    var s = window.location.href;
    var q = s.indexOf("?");
    var query = s.substr(q + 1);
    tdl.log("query:", query);
    var pairs = query.split("&");
    tdl.log("pairs:", pairs.length);
    for (var ii = 0; ii < pairs.length; ++ii) {
      var keyValue = pairs[ii].split("=");
      var key = keyValue[0];
      var value = decodeURIComponent(keyValue[1]);
      tdl.log(ii, ":", key, "=", value);
      switch (key) {
      case 'settings':
        tdl.log(value);
        var obj = eval("(" + value + ")");
        tdl.log("obj:", obj);
        this.setSettings(obj);
        break;
      }
    }
  } catch (e) {
    tdl.error(e);
    return;
  }
}

/**
 * Initialize the sync manager to start syncing settings with a server.
 * @param {string} server domain name of server.
 * @param {number} port port of server.
 * @param {boolean} slave true if this page is a slave. Slaves only receive
 *     settings from the server. Non slaves send settings the server.
 */
tdl.sync.SyncManager.prototype.init = function(server, port, slave) {
  var that = this;
  this.sync = true;
  this.slave = slave;
  this.socket = new io.Socket(null, {
      port: port,
      transports: ['websocket']});
  this.socket.connect();
  this.socket.on('message', function(obj) {
    ++that.getCount;
    tdl.log("--GET:[", g_getCount, "]-------------");
    tdl.dumpObj(obj);
    that.applySettings_(obj, that.settings);
  });
};

/**
 * Applies settings recursively
 * @private
 * @param {!Object} obj Object with new settings.
 * @param {!Object} dst Object to receive new settings.
 */
tdl.sync.SyncManager.prototype.applySettings_ = function(obj, dst) {
  for (var name in obj) {
    var value = obj[name];
    if (typeof value == 'object') {
      this.applySettings_(value, dst[name]);
      //tdl.log("apply->: ", name);
    } else {
      //tdl.log("apply: ", name, "=", value);
      dst[name] = value;
    }
  }
};

/**
 * Sets the settings.
 *
 * If we are synchronizing settings the settings are sent to the server.
 * Otherwise they are applied directy.
 *
 * @param {!Object} settings Object with new settings.
 */
tdl.sync.SyncManager.prototype.setSettings = function(settings) {
  if (this.sync) {
    if (!this.slave) {
      if (this.socket) {
        ++this.putCount;
        tdl.log("--PUT:[", this.putCount, "]-------------");
        tdl.dumpObj(settings);
        this.socket.send(settings);
      }
    }
  } else {
    this.applySettings_(settings, this.settings);
  }
};


