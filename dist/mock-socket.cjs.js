'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

/**
 * Check if we're required to add a port number.
 *
 * @see https://url.spec.whatwg.org/#default-port
 * @param {Number|String} port Port number we need to check
 * @param {String} protocol Protocol we need to check against.
 * @returns {Boolean} Is it a default port for the given protocol
 * @api private
 */
var requiresPort = function required(port, protocol) {
  protocol = protocol.split(':')[0];
  port = +port;

  if (!port) { return false; }

  switch (protocol) {
    case 'http':
    case 'ws':
    return port !== 80;

    case 'https':
    case 'wss':
    return port !== 443;

    case 'ftp':
    return port !== 21;

    case 'gopher':
    return port !== 70;

    case 'file':
    return false;
  }

  return port !== 0;
};

var has = Object.prototype.hasOwnProperty;
var undef;

/**
 * Decode a URI encoded string.
 *
 * @param {String} input The URI encoded string.
 * @returns {String} The decoded string.
 * @api private
 */
function decode(input) {
  return decodeURIComponent(input.replace(/\+/g, ' '));
}

/**
 * Simple query string parser.
 *
 * @param {String} query The query string that needs to be parsed.
 * @returns {Object}
 * @api public
 */
function querystring(query) {
  var parser = /([^=?&]+)=?([^&]*)/g
    , result = {}
    , part;

  while (part = parser.exec(query)) {
    var key = decode(part[1])
      , value = decode(part[2]);

    //
    // Prevent overriding of existing properties. This ensures that build-in
    // methods like `toString` or __proto__ are not overriden by malicious
    // querystrings.
    //
    if (key in result) { continue; }
    result[key] = value;
  }

  return result;
}

/**
 * Transform a query string to an object.
 *
 * @param {Object} obj Object that should be transformed.
 * @param {String} prefix Optional prefix.
 * @returns {String}
 * @api public
 */
function querystringify(obj, prefix) {
  prefix = prefix || '';

  var pairs = []
    , value
    , key;

  //
  // Optionally prefix with a '?' if needed
  //
  if ('string' !== typeof prefix) { prefix = '?'; }

  for (key in obj) {
    if (has.call(obj, key)) {
      value = obj[key];

      //
      // Edge cases where we actually want to encode the value to an empty
      // string instead of the stringified value.
      //
      if (!value && (value === null || value === undef || isNaN(value))) {
        value = '';
      }

      pairs.push(encodeURIComponent(key) +'='+ encodeURIComponent(value));
    }
  }

  return pairs.length ? prefix + pairs.join('&') : '';
}

//
// Expose the module.
//
var stringify = querystringify;
var parse = querystring;

var querystringify_1 = {
	stringify: stringify,
	parse: parse
};

var protocolre = /^([a-z][a-z0-9.+-]*:)?(\/\/)?([\S\s]*)/i;
var slashes = /^[A-Za-z][A-Za-z0-9+-.]*:\/\//;

/**
 * These are the parse rules for the URL parser, it informs the parser
 * about:
 *
 * 0. The char it Needs to parse, if it's a string it should be done using
 *    indexOf, RegExp using exec and NaN means set as current value.
 * 1. The property we should set when parsing this value.
 * 2. Indication if it's backwards or forward parsing, when set as number it's
 *    the value of extra chars that should be split off.
 * 3. Inherit from location if non existing in the parser.
 * 4. `toLowerCase` the resulting value.
 */
var rules = [
  ['#', 'hash'],                        // Extract from the back.
  ['?', 'query'],                       // Extract from the back.
  function sanitize(address) {          // Sanitize what is left of the address
    return address.replace('\\', '/');
  },
  ['/', 'pathname'],                    // Extract from the back.
  ['@', 'auth', 1],                     // Extract from the front.
  [NaN, 'host', undefined, 1, 1],       // Set left over value.
  [/:(\d+)$/, 'port', undefined, 1],    // RegExp the back.
  [NaN, 'hostname', undefined, 1, 1]    // Set left over.
];

/**
 * These properties should not be copied or inherited from. This is only needed
 * for all non blob URL's as a blob URL does not include a hash, only the
 * origin.
 *
 * @type {Object}
 * @private
 */
var ignore = { hash: 1, query: 1 };

/**
 * The location object differs when your code is loaded through a normal page,
 * Worker or through a worker using a blob. And with the blobble begins the
 * trouble as the location object will contain the URL of the blob, not the
 * location of the page where our code is loaded in. The actual origin is
 * encoded in the `pathname` so we can thankfully generate a good "default"
 * location from it so we can generate proper relative URL's again.
 *
 * @param {Object|String} loc Optional default location object.
 * @returns {Object} lolcation object.
 * @public
 */
function lolcation(loc) {
  var globalVar;

  if (typeof window !== 'undefined') { globalVar = window; }
  else if (typeof commonjsGlobal !== 'undefined') { globalVar = commonjsGlobal; }
  else if (typeof self !== 'undefined') { globalVar = self; }
  else { globalVar = {}; }

  var location = globalVar.location || {};
  loc = loc || location;

  var finaldestination = {}
    , type = typeof loc
    , key;

  if ('blob:' === loc.protocol) {
    finaldestination = new Url(unescape(loc.pathname), {});
  } else if ('string' === type) {
    finaldestination = new Url(loc, {});
    for (key in ignore) { delete finaldestination[key]; }
  } else if ('object' === type) {
    for (key in loc) {
      if (key in ignore) { continue; }
      finaldestination[key] = loc[key];
    }

    if (finaldestination.slashes === undefined) {
      finaldestination.slashes = slashes.test(loc.href);
    }
  }

  return finaldestination;
}

/**
 * @typedef ProtocolExtract
 * @type Object
 * @property {String} protocol Protocol matched in the URL, in lowercase.
 * @property {Boolean} slashes `true` if protocol is followed by "//", else `false`.
 * @property {String} rest Rest of the URL that is not part of the protocol.
 */

/**
 * Extract protocol information from a URL with/without double slash ("//").
 *
 * @param {String} address URL we want to extract from.
 * @return {ProtocolExtract} Extracted information.
 * @private
 */
function extractProtocol(address) {
  var match = protocolre.exec(address);

  return {
    protocol: match[1] ? match[1].toLowerCase() : '',
    slashes: !!match[2],
    rest: match[3]
  };
}

/**
 * Resolve a relative URL pathname against a base URL pathname.
 *
 * @param {String} relative Pathname of the relative URL.
 * @param {String} base Pathname of the base URL.
 * @return {String} Resolved pathname.
 * @private
 */
function resolve(relative, base) {
  var path = (base || '/').split('/').slice(0, -1).concat(relative.split('/'))
    , i = path.length
    , last = path[i - 1]
    , unshift = false
    , up = 0;

  while (i--) {
    if (path[i] === '.') {
      path.splice(i, 1);
    } else if (path[i] === '..') {
      path.splice(i, 1);
      up++;
    } else if (up) {
      if (i === 0) { unshift = true; }
      path.splice(i, 1);
      up--;
    }
  }

  if (unshift) { path.unshift(''); }
  if (last === '.' || last === '..') { path.push(''); }

  return path.join('/');
}

/**
 * The actual URL instance. Instead of returning an object we've opted-in to
 * create an actual constructor as it's much more memory efficient and
 * faster and it pleases my OCD.
 *
 * It is worth noting that we should not use `URL` as class name to prevent
 * clashes with the global URL instance that got introduced in browsers.
 *
 * @constructor
 * @param {String} address URL we want to parse.
 * @param {Object|String} [location] Location defaults for relative paths.
 * @param {Boolean|Function} [parser] Parser for the query string.
 * @private
 */
function Url(address, location, parser) {
  if (!(this instanceof Url)) {
    return new Url(address, location, parser);
  }

  var relative, extracted, parse, instruction, index, key
    , instructions = rules.slice()
    , type = typeof location
    , url = this
    , i = 0;

  //
  // The following if statements allows this module two have compatibility with
  // 2 different API:
  //
  // 1. Node.js's `url.parse` api which accepts a URL, boolean as arguments
  //    where the boolean indicates that the query string should also be parsed.
  //
  // 2. The `URL` interface of the browser which accepts a URL, object as
  //    arguments. The supplied object will be used as default values / fall-back
  //    for relative paths.
  //
  if ('object' !== type && 'string' !== type) {
    parser = location;
    location = null;
  }

  if (parser && 'function' !== typeof parser) { parser = querystringify_1.parse; }

  location = lolcation(location);

  //
  // Extract protocol information before running the instructions.
  //
  extracted = extractProtocol(address || '');
  relative = !extracted.protocol && !extracted.slashes;
  url.slashes = extracted.slashes || relative && location.slashes;
  url.protocol = extracted.protocol || location.protocol || '';
  address = extracted.rest;

  //
  // When the authority component is absent the URL starts with a path
  // component.
  //
  if (!extracted.slashes) { instructions[3] = [/(.*)/, 'pathname']; }

  for (; i < instructions.length; i++) {
    instruction = instructions[i];

    if (typeof instruction === 'function') {
      address = instruction(address);
      continue;
    }

    parse = instruction[0];
    key = instruction[1];

    if (parse !== parse) {
      url[key] = address;
    } else if ('string' === typeof parse) {
      if (~(index = address.indexOf(parse))) {
        if ('number' === typeof instruction[2]) {
          url[key] = address.slice(0, index);
          address = address.slice(index + instruction[2]);
        } else {
          url[key] = address.slice(index);
          address = address.slice(0, index);
        }
      }
    } else if ((index = parse.exec(address))) {
      url[key] = index[1];
      address = address.slice(0, index.index);
    }

    url[key] = url[key] || (
      relative && instruction[3] ? location[key] || '' : ''
    );

    //
    // Hostname, host and protocol should be lowercased so they can be used to
    // create a proper `origin`.
    //
    if (instruction[4]) { url[key] = url[key].toLowerCase(); }
  }

  //
  // Also parse the supplied query string in to an object. If we're supplied
  // with a custom parser as function use that instead of the default build-in
  // parser.
  //
  if (parser) { url.query = parser(url.query); }

  //
  // If the URL is relative, resolve the pathname against the base URL.
  //
  if (
      relative
    && location.slashes
    && url.pathname.charAt(0) !== '/'
    && (url.pathname !== '' || location.pathname !== '')
  ) {
    url.pathname = resolve(url.pathname, location.pathname);
  }

  //
  // We should not add port numbers if they are already the default port number
  // for a given protocol. As the host also contains the port number we're going
  // override it with the hostname which contains no port number.
  //
  if (!requiresPort(url.port, url.protocol)) {
    url.host = url.hostname;
    url.port = '';
  }

  //
  // Parse down the `auth` for the username and password.
  //
  url.username = url.password = '';
  if (url.auth) {
    instruction = url.auth.split(':');
    url.username = instruction[0] || '';
    url.password = instruction[1] || '';
  }

  url.origin = url.protocol && url.host && url.protocol !== 'file:'
    ? url.protocol +'//'+ url.host
    : 'null';

  //
  // The href is just the compiled result.
  //
  url.href = url.toString();
}

/**
 * This is convenience method for changing properties in the URL instance to
 * insure that they all propagate correctly.
 *
 * @param {String} part          Property we need to adjust.
 * @param {Mixed} value          The newly assigned value.
 * @param {Boolean|Function} fn  When setting the query, it will be the function
 *                               used to parse the query.
 *                               When setting the protocol, double slash will be
 *                               removed from the final url if it is true.
 * @returns {URL} URL instance for chaining.
 * @public
 */
function set(part, value, fn) {
  var url = this;

  switch (part) {
    case 'query':
      if ('string' === typeof value && value.length) {
        value = (fn || querystringify_1.parse)(value);
      }

      url[part] = value;
      break;

    case 'port':
      url[part] = value;

      if (!requiresPort(value, url.protocol)) {
        url.host = url.hostname;
        url[part] = '';
      } else if (value) {
        url.host = url.hostname +':'+ value;
      }

      break;

    case 'hostname':
      url[part] = value;

      if (url.port) { value += ':'+ url.port; }
      url.host = value;
      break;

    case 'host':
      url[part] = value;

      if (/:\d+$/.test(value)) {
        value = value.split(':');
        url.port = value.pop();
        url.hostname = value.join(':');
      } else {
        url.hostname = value;
        url.port = '';
      }

      break;

    case 'protocol':
      url.protocol = value.toLowerCase();
      url.slashes = !fn;
      break;

    case 'pathname':
    case 'hash':
      if (value) {
        var char = part === 'pathname' ? '/' : '#';
        url[part] = value.charAt(0) !== char ? char + value : value;
      } else {
        url[part] = value;
      }
      break;

    default:
      url[part] = value;
  }

  for (var i = 0; i < rules.length; i++) {
    var ins = rules[i];

    if (ins[4]) { url[ins[1]] = url[ins[1]].toLowerCase(); }
  }

  url.origin = url.protocol && url.host && url.protocol !== 'file:'
    ? url.protocol +'//'+ url.host
    : 'null';

  url.href = url.toString();

  return url;
}

/**
 * Transform the properties back in to a valid and full URL string.
 *
 * @param {Function} stringify Optional query stringify function.
 * @returns {String} Compiled version of the URL.
 * @public
 */
function toString(stringify) {
  if (!stringify || 'function' !== typeof stringify) { stringify = querystringify_1.stringify; }

  var query
    , url = this
    , protocol = url.protocol;

  if (protocol && protocol.charAt(protocol.length - 1) !== ':') { protocol += ':'; }

  var result = protocol + (url.slashes ? '//' : '');

  if (url.username) {
    result += url.username;
    if (url.password) { result += ':'+ url.password; }
    result += '@';
  }

  result += url.host + url.pathname;

  query = 'object' === typeof url.query ? stringify(url.query) : url.query;
  if (query) { result += '?' !== query.charAt(0) ? '?'+ query : query; }

  if (url.hash) { result += url.hash; }

  return result;
}

Url.prototype = { set: set, toString: toString };

//
// Expose the URL parser and some additional properties that might be useful for
// others or testing.
//
Url.extractProtocol = extractProtocol;
Url.location = lolcation;
Url.qs = querystringify_1;

var urlParse = Url;

/*
 * This delay allows the thread to finish assigning its on* methods
 * before invoking the delay callback. This is purely a timing hack.
 * http://geekabyte.blogspot.com/2014/01/javascript-effect-of-setting-settimeout.html
 *
 * @param {callback: function} the callback which will be invoked after the timeout
 * @parma {context: object} the context in which to invoke the function
 */
function delay(callback, context) {
  setTimeout(function (timeoutContext) { return callback.call(timeoutContext); }, 4, context);
}

function log(method, message) {
  /* eslint-disable no-console */
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
    console[method].call(null, message);
  }
  /* eslint-enable no-console */
}

function reject(array, callback) {
  var results = [];
  array.forEach(function (itemInArray) {
    if (!callback(itemInArray)) {
      results.push(itemInArray);
    }
  });

  return results;
}

function filter(array, callback) {
  var results = [];
  array.forEach(function (itemInArray) {
    if (callback(itemInArray)) {
      results.push(itemInArray);
    }
  });

  return results;
}

/*
 * EventTarget is an interface implemented by objects that can
 * receive events and may have listeners for them.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
 */
var EventTarget = function EventTarget() {
  this.listeners = {};
};

/*
 * Ties a listener function to an event type which can later be invoked via the
 * dispatchEvent method.
 *
 * @param {string} type - the type of event (ie: 'open', 'message', etc.)
 * @param {function} listener - callback function to invoke when an event is dispatched matching the type
 * @param {boolean} useCapture - N/A TODO: implement useCapture functionality
 */
EventTarget.prototype.addEventListener = function addEventListener (type, listener /* , useCapture */) {
  if (typeof listener === 'function') {
    if (!Array.isArray(this.listeners[type])) {
      this.listeners[type] = [];
    }

    // Only add the same function once
    if (filter(this.listeners[type], function (item) { return item === listener; }).length === 0) {
      this.listeners[type].push(listener);
    }
  }
};

/*
 * Removes the listener so it will no longer be invoked via the dispatchEvent method.
 *
 * @param {string} type - the type of event (ie: 'open', 'message', etc.)
 * @param {function} listener - callback function to invoke when an event is dispatched matching the type
 * @param {boolean} useCapture - N/A TODO: implement useCapture functionality
 */
EventTarget.prototype.removeEventListener = function removeEventListener (type, removingListener /* , useCapture */) {
  var arrayOfListeners = this.listeners[type];
  this.listeners[type] = reject(arrayOfListeners, function (listener) { return listener === removingListener; });
};

/*
 * Invokes all listener functions that are listening to the given event.type property. Each
 * listener will be passed the event as the first argument.
 *
 * @param {object} event - event object which will be passed to all listeners of the event.type property
 */
EventTarget.prototype.dispatchEvent = function dispatchEvent (event) {
    var this$1 = this;
    var customArguments = [], len = arguments.length - 1;
    while ( len-- > 0 ) customArguments[ len ] = arguments[ len + 1 ];

  var eventName = event.type;
  var listeners = this.listeners[eventName];

  if (!Array.isArray(listeners)) {
    return false;
  }

  listeners.forEach(function (listener) {
    if (customArguments.length > 0) {
      listener.apply(this$1, customArguments);
    } else {
      listener.call(this$1, event);
    }
  });

  return true;
};

function trimQueryPartFromURL(url) {
  var queryIndex = url.indexOf('?');
  return queryIndex >= 0 ? url.slice(0, queryIndex) : url;
}

/*
 * The network bridge is a way for the mock websocket object to 'communicate' with
 * all available servers. This is a singleton object so it is important that you
 * clean up urlMap whenever you are finished.
 */
var NetworkBridge = function NetworkBridge() {
  this.urlMap = {};
};

/*
 * Attaches a websocket object to the urlMap hash so that it can find the server
 * it is connected to and the server in turn can find it.
 *
 * @param {object} websocket - websocket object to add to the urlMap hash
 * @param {string} url
 */
NetworkBridge.prototype.attachWebSocket = function attachWebSocket (websocket, url) {
  var serverURL = trimQueryPartFromURL(url);
  var connectionLookup = this.urlMap[serverURL];

  if (connectionLookup && connectionLookup.server && connectionLookup.websockets.indexOf(websocket) === -1) {
    connectionLookup.websockets.push(websocket);
    return connectionLookup.server;
  }
};

/*
 * Attaches a websocket to a room
 */
NetworkBridge.prototype.addMembershipToRoom = function addMembershipToRoom (websocket, room) {
  var connectionLookup = this.urlMap[trimQueryPartFromURL(websocket.url)];

  if (connectionLookup && connectionLookup.server && connectionLookup.websockets.indexOf(websocket) !== -1) {
    if (!connectionLookup.roomMemberships[room]) {
      connectionLookup.roomMemberships[room] = [];
    }

    connectionLookup.roomMemberships[room].push(websocket);
  }
};

/*
 * Attaches a server object to the urlMap hash so that it can find a websockets
 * which are connected to it and so that websockets can in turn can find it.
 *
 * @param {object} server - server object to add to the urlMap hash
 * @param {string} url
 */
NetworkBridge.prototype.attachServer = function attachServer (server, url) {
  var connectionLookup = this.urlMap[url];

  if (!connectionLookup) {
    this.urlMap[url] = {
      server: server,
      websockets: [],
      roomMemberships: {}
    };

    return server;
  }
};

/*
 * Finds the server which is 'running' on the given url.
 *
 * @param {string} url - the url to use to find which server is running on it
 */
NetworkBridge.prototype.serverLookup = function serverLookup (url) {
  var serverURL = trimQueryPartFromURL(url);
  var connectionLookup = this.urlMap[serverURL];

  if (connectionLookup) {
    return connectionLookup.server;
  }
};

/*
 * Finds all websockets which is 'listening' on the given url.
 *
 * @param {string} url - the url to use to find all websockets which are associated with it
 * @param {string} room - if a room is provided, will only return sockets in this room
 * @param {class} broadcaster - socket that is broadcasting and is to be excluded from the lookup
 */
NetworkBridge.prototype.websocketsLookup = function websocketsLookup (url, room, broadcaster) {
  var serverURL = trimQueryPartFromURL(url);
  var websockets;
  var connectionLookup = this.urlMap[serverURL];

  websockets = connectionLookup ? connectionLookup.websockets : [];

  if (room) {
    var members = connectionLookup.roomMemberships[room];
    websockets = members || [];
  }

  return broadcaster ? websockets.filter(function (websocket) { return websocket !== broadcaster; }) : websockets;
};

/*
 * Removes the entry associated with the url.
 *
 * @param {string} url
 */
NetworkBridge.prototype.removeServer = function removeServer (url) {
  delete this.urlMap[trimQueryPartFromURL(url)];
};

/*
 * Removes the individual websocket from the map of associated websockets.
 *
 * @param {object} websocket - websocket object to remove from the url map
 * @param {string} url
 */
NetworkBridge.prototype.removeWebSocket = function removeWebSocket (websocket, url) {
  var serverURL = trimQueryPartFromURL(url);
  var connectionLookup = this.urlMap[serverURL];

  if (connectionLookup) {
    connectionLookup.websockets = reject(connectionLookup.websockets, function (socket) { return socket === websocket; });
  }
};

/*
 * Removes a websocket from a room
 */
NetworkBridge.prototype.removeMembershipFromRoom = function removeMembershipFromRoom (websocket, room) {
  var connectionLookup = this.urlMap[trimQueryPartFromURL(websocket.url)];
  var memberships = connectionLookup.roomMemberships[room];

  if (connectionLookup && memberships !== null) {
    connectionLookup.roomMemberships[room] = reject(memberships, function (socket) { return socket === websocket; });
  }
};

var networkBridge = new NetworkBridge(); // Note: this is a singleton

/*
 * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
 */
var CLOSE_CODES = {
  CLOSE_NORMAL: 1000,
  CLOSE_GOING_AWAY: 1001,
  CLOSE_PROTOCOL_ERROR: 1002,
  CLOSE_UNSUPPORTED: 1003,
  CLOSE_NO_STATUS: 1005,
  CLOSE_ABNORMAL: 1006,
  UNSUPPORTED_DATA: 1007,
  POLICY_VIOLATION: 1008,
  CLOSE_TOO_LARGE: 1009,
  MISSING_EXTENSION: 1010,
  INTERNAL_ERROR: 1011,
  SERVICE_RESTART: 1012,
  TRY_AGAIN_LATER: 1013,
  TLS_HANDSHAKE: 1015
};

var ERROR_PREFIX = {
  CONSTRUCTOR_ERROR: "Failed to construct 'WebSocket':",
  CLOSE_ERROR: "Failed to execute 'close' on 'WebSocket':",
  EVENT: {
    CONSTRUCT: "Failed to construct 'Event':",
    MESSAGE: "Failed to construct 'MessageEvent':",
    CLOSE: "Failed to construct 'CloseEvent':"
  }
};

var EventPrototype = function EventPrototype () {};

EventPrototype.prototype.stopPropagation = function stopPropagation () {};
EventPrototype.prototype.stopImmediatePropagation = function stopImmediatePropagation () {};

// if no arguments are passed then the type is set to "undefined" on
// chrome and safari.
EventPrototype.prototype.initEvent = function initEvent (type, bubbles, cancelable) {
    if ( type === void 0 ) type = 'undefined';
    if ( bubbles === void 0 ) bubbles = false;
    if ( cancelable === void 0 ) cancelable = false;

  this.type = "" + type;
  this.bubbles = Boolean(bubbles);
  this.cancelable = Boolean(cancelable);
};

var Event = (function (EventPrototype$$1) {
  function Event(type, eventInitConfig) {
    if ( eventInitConfig === void 0 ) eventInitConfig = {};

    EventPrototype$$1.call(this);

    if (!type) {
      throw new TypeError(((ERROR_PREFIX.EVENT_ERROR) + " 1 argument required, but only 0 present."));
    }

    if (typeof eventInitConfig !== 'object') {
      throw new TypeError(((ERROR_PREFIX.EVENT_ERROR) + " parameter 2 ('eventInitDict') is not an object."));
    }

    var bubbles = eventInitConfig.bubbles;
    var cancelable = eventInitConfig.cancelable;

    this.type = "" + type;
    this.timeStamp = Date.now();
    this.target = null;
    this.srcElement = null;
    this.returnValue = true;
    this.isTrusted = false;
    this.eventPhase = 0;
    this.defaultPrevented = false;
    this.currentTarget = null;
    this.cancelable = cancelable ? Boolean(cancelable) : false;
    this.canncelBubble = false;
    this.bubbles = bubbles ? Boolean(bubbles) : false;
  }

  if ( EventPrototype$$1 ) Event.__proto__ = EventPrototype$$1;
  Event.prototype = Object.create( EventPrototype$$1 && EventPrototype$$1.prototype );
  Event.prototype.constructor = Event;

  return Event;
}(EventPrototype));

var MessageEvent = (function (EventPrototype$$1) {
  function MessageEvent(type, eventInitConfig) {
    if ( eventInitConfig === void 0 ) eventInitConfig = {};

    EventPrototype$$1.call(this);

    if (!type) {
      throw new TypeError(((ERROR_PREFIX.EVENT.MESSAGE) + " 1 argument required, but only 0 present."));
    }

    if (typeof eventInitConfig !== 'object') {
      throw new TypeError(((ERROR_PREFIX.EVENT.MESSAGE) + " parameter 2 ('eventInitDict') is not an object"));
    }

    var bubbles = eventInitConfig.bubbles;
    var cancelable = eventInitConfig.cancelable;
    var data = eventInitConfig.data;
    var origin = eventInitConfig.origin;
    var lastEventId = eventInitConfig.lastEventId;
    var ports = eventInitConfig.ports;

    this.type = "" + type;
    this.timeStamp = Date.now();
    this.target = null;
    this.srcElement = null;
    this.returnValue = true;
    this.isTrusted = false;
    this.eventPhase = 0;
    this.defaultPrevented = false;
    this.currentTarget = null;
    this.cancelable = cancelable ? Boolean(cancelable) : false;
    this.canncelBubble = false;
    this.bubbles = bubbles ? Boolean(bubbles) : false;
    this.origin = "" + origin;
    this.ports = typeof ports === 'undefined' ? null : ports;
    this.data = typeof data === 'undefined' ? null : data;
    this.lastEventId = "" + (lastEventId || '');
  }

  if ( EventPrototype$$1 ) MessageEvent.__proto__ = EventPrototype$$1;
  MessageEvent.prototype = Object.create( EventPrototype$$1 && EventPrototype$$1.prototype );
  MessageEvent.prototype.constructor = MessageEvent;

  return MessageEvent;
}(EventPrototype));

var CloseEvent = (function (EventPrototype$$1) {
  function CloseEvent(type, eventInitConfig) {
    if ( eventInitConfig === void 0 ) eventInitConfig = {};

    EventPrototype$$1.call(this);

    if (!type) {
      throw new TypeError(((ERROR_PREFIX.EVENT.CLOSE) + " 1 argument required, but only 0 present."));
    }

    if (typeof eventInitConfig !== 'object') {
      throw new TypeError(((ERROR_PREFIX.EVENT.CLOSE) + " parameter 2 ('eventInitDict') is not an object"));
    }

    var bubbles = eventInitConfig.bubbles;
    var cancelable = eventInitConfig.cancelable;
    var code = eventInitConfig.code;
    var reason = eventInitConfig.reason;
    var wasClean = eventInitConfig.wasClean;

    this.type = "" + type;
    this.timeStamp = Date.now();
    this.target = null;
    this.srcElement = null;
    this.returnValue = true;
    this.isTrusted = false;
    this.eventPhase = 0;
    this.defaultPrevented = false;
    this.currentTarget = null;
    this.cancelable = cancelable ? Boolean(cancelable) : false;
    this.cancelBubble = false;
    this.bubbles = bubbles ? Boolean(bubbles) : false;
    this.code = typeof code === 'number' ? parseInt(code, 10) : 0;
    this.reason = "" + (reason || '');
    this.wasClean = wasClean ? Boolean(wasClean) : false;
  }

  if ( EventPrototype$$1 ) CloseEvent.__proto__ = EventPrototype$$1;
  CloseEvent.prototype = Object.create( EventPrototype$$1 && EventPrototype$$1.prototype );
  CloseEvent.prototype.constructor = CloseEvent;

  return CloseEvent;
}(EventPrototype));

/*
 * Creates an Event object and extends it to allow full modification of
 * its properties.
 *
 * @param {object} config - within config you will need to pass type and optionally target
 */
function createEvent(config) {
  var type = config.type;
  var target = config.target;
  var eventObject = new Event(type);

  if (target) {
    eventObject.target = target;
    eventObject.srcElement = target;
    eventObject.currentTarget = target;
  }

  return eventObject;
}

/*
 * Creates a MessageEvent object and extends it to allow full modification of
 * its properties.
 *
 * @param {object} config - within config: type, origin, data and optionally target
 */
function createMessageEvent(config) {
  var type = config.type;
  var origin = config.origin;
  var data = config.data;
  var target = config.target;
  var messageEvent = new MessageEvent(type, {
    data: data,
    origin: origin
  });

  if (target) {
    messageEvent.target = target;
    messageEvent.srcElement = target;
    messageEvent.currentTarget = target;
  }

  return messageEvent;
}

/*
 * Creates a CloseEvent object and extends it to allow full modification of
 * its properties.
 *
 * @param {object} config - within config: type and optionally target, code, and reason
 */
function createCloseEvent(config) {
  var code = config.code;
  var reason = config.reason;
  var type = config.type;
  var target = config.target;
  var wasClean = config.wasClean;

  if (!wasClean) {
    wasClean = code === 1000;
  }

  var closeEvent = new CloseEvent(type, {
    code: code,
    reason: reason,
    wasClean: wasClean
  });

  if (target) {
    closeEvent.target = target;
    closeEvent.srcElement = target;
    closeEvent.currentTarget = target;
  }

  return closeEvent;
}

function closeWebSocketConnection(context, code, reason) {
  context.readyState = WebSocket$1.CLOSING;

  var server = networkBridge.serverLookup(context.url);
  var closeEvent = createCloseEvent({
    type: 'close',
    target: context,
    code: code,
    reason: reason
  });

  delay(function () {
    networkBridge.removeWebSocket(context, context.url);

    context.readyState = WebSocket$1.CLOSED;
    context.dispatchEvent(closeEvent);

    if (server) {
      server.dispatchEvent(closeEvent, server);
    }
  }, context);
}

function failWebSocketConnection(context, code, reason) {
  context.readyState = WebSocket$1.CLOSING;

  var server = networkBridge.serverLookup(context.url);
  var closeEvent = createCloseEvent({
    type: 'close',
    target: context,
    code: code,
    reason: reason,
    wasClean: false
  });

  var errorEvent = createEvent({
    type: 'error',
    target: context
  });

  delay(function () {
    networkBridge.removeWebSocket(context, context.url);

    context.readyState = WebSocket$1.CLOSED;
    context.dispatchEvent(errorEvent);
    context.dispatchEvent(closeEvent);

    if (server) {
      server.dispatchEvent(closeEvent, server);
    }
  }, context);
}

function normalizeSendData(data) {
  if (Object.prototype.toString.call(data) !== '[object Blob]' && !(data instanceof ArrayBuffer)) {
    data = String(data);
  }

  return data;
}

function proxyFactory(target) {
  var handler = {
    get: function get(obj, prop) {
      if (prop === 'close') {
        return function close(options) {
          if ( options === void 0 ) options = {};

          var code = options.code || CLOSE_CODES.CLOSE_NORMAL;
          var reason = options.reason || '';

          closeWebSocketConnection(target, code, reason);
        };
      }

      if (prop === 'send') {
        return function send(data) {
          data = normalizeSendData(data);

          target.dispatchEvent(
            createMessageEvent({
              type: 'message',
              data: data,
              origin: this.url,
              target: target
            })
          );
        };
      }

      if (prop === 'on') {
        return function onWrapper(type, cb) {
          target.addEventListener(("server::" + type), cb);
        };
      }

      return obj[prop];
    }
  };

  var proxy = new Proxy(target, handler);
  return proxy;
}

function lengthInUtf8Bytes(str) {
  // Matches only the 10.. bytes that are non-initial characters in a multi-byte sequence.
  var m = encodeURIComponent(str).match(/%[89ABab]/g);
  return str.length + (m ? m.length : 0);
}

function urlVerification(url) {
  var urlRecord = new urlParse(url);
  var pathname = urlRecord.pathname;
  var protocol = urlRecord.protocol;
  var hash = urlRecord.hash;

  if (!url) {
    throw new TypeError(((ERROR_PREFIX.CONSTRUCTOR_ERROR) + " 1 argument required, but only 0 present."));
  }

  if (!pathname) {
    urlRecord.pathname = '/';
  }

  if (protocol === '') {
    throw new SyntaxError(((ERROR_PREFIX.CONSTRUCTOR_ERROR) + " The URL '" + (urlRecord.toString()) + "' is invalid."));
  }

  if (protocol !== 'ws:' && protocol !== 'wss:') {
    throw new SyntaxError(
      ((ERROR_PREFIX.CONSTRUCTOR_ERROR) + " The URL's scheme must be either 'ws' or 'wss'. '" + protocol + "' is not allowed.")
    );
  }

  if (hash !== '') {
    /* eslint-disable max-len */
    throw new SyntaxError(
      ((ERROR_PREFIX.CONSTRUCTOR_ERROR) + " The URL contains a fragment identifier ('" + hash + "'). Fragment identifiers are not allowed in WebSocket URLs.")
    );
    /* eslint-enable max-len */
  }

  return urlRecord.toString();
}

function protocolVerification(protocols) {
  if ( protocols === void 0 ) protocols = [];

  if (!Array.isArray(protocols) && typeof protocols !== 'string') {
    throw new SyntaxError(((ERROR_PREFIX.CONSTRUCTOR_ERROR) + " The subprotocol '" + (protocols.toString()) + "' is invalid."));
  }

  if (typeof protocols === 'string') {
    protocols = [protocols];
  }

  var uniq = protocols
    .map(function (p) { return ({ count: 1, protocol: p }); })
    .reduce(function (a, b) {
      a[b.protocol] = (a[b.protocol] || 0) + b.count;
      return a;
    }, {});

  var duplicates = Object.keys(uniq).filter(function (a) { return uniq[a] > 1; });

  if (duplicates.length > 0) {
    throw new SyntaxError(((ERROR_PREFIX.CONSTRUCTOR_ERROR) + " The subprotocol '" + (duplicates[0]) + "' is duplicated."));
  }

  return protocols;
}

/*
 * The main websocket class which is designed to mimick the native WebSocket class as close
 * as possible.
 *
 * https://html.spec.whatwg.org/multipage/web-sockets.html
 */
var WebSocket$1 = (function (EventTarget$$1) {
  function WebSocket(url, protocols) {
    EventTarget$$1.call(this);

    this.url = urlVerification(url);
    protocols = protocolVerification(protocols);
    this.protocol = protocols[0] || '';

    this.binaryType = 'blob';
    this.readyState = WebSocket.CONNECTING;

    var server = networkBridge.attachWebSocket(this, this.url);

    /*
     * This delay is needed so that we dont trigger an event before the callbacks have been
     * setup. For example:
     *
     * var socket = new WebSocket('ws://localhost');
     *
     * If we dont have the delay then the event would be triggered right here and this is
     * before the onopen had a chance to register itself.
     *
     * socket.onopen = () => { // this would never be called };
     *
     * and with the delay the event gets triggered here after all of the callbacks have been
     * registered :-)
     */
    delay(function delayCallback() {
      if (server) {
        if (
          server.options.verifyClient &&
          typeof server.options.verifyClient === 'function' &&
          !server.options.verifyClient()
        ) {
          this.readyState = WebSocket.CLOSED;

          log(
            'error',
            ("WebSocket connection to '" + (this.url) + "' failed: HTTP Authentication failed; no valid credentials available")
          );

          networkBridge.removeWebSocket(this, this.url);
          this.dispatchEvent(createEvent({ type: 'error', target: this }));
          this.dispatchEvent(createCloseEvent({ type: 'close', target: this, code: CLOSE_CODES.CLOSE_NORMAL }));
        } else {
          if (server.options.selectProtocol && typeof server.options.selectProtocol === 'function') {
            var selectedProtocol = server.options.selectProtocol(protocols);
            var isFilled = selectedProtocol !== '';
            var isRequested = protocols.indexOf(selectedProtocol) !== -1;
            if (isFilled && !isRequested) {
              this.readyState = WebSocket.CLOSED;

              log('error', ("WebSocket connection to '" + (this.url) + "' failed: Invalid Sub-Protocol"));

              networkBridge.removeWebSocket(this, this.url);
              this.dispatchEvent(createEvent({ type: 'error', target: this }));
              this.dispatchEvent(createCloseEvent({ type: 'close', target: this, code: CLOSE_CODES.CLOSE_NORMAL }));
              return;
            }
            this.protocol = selectedProtocol;
          }
          this.readyState = WebSocket.OPEN;
          this.dispatchEvent(createEvent({ type: 'open', target: this }));
          server.dispatchEvent(createEvent({ type: 'connection' }), proxyFactory(this));
        }
      } else {
        this.readyState = WebSocket.CLOSED;
        this.dispatchEvent(createEvent({ type: 'error', target: this }));
        this.dispatchEvent(createCloseEvent({ type: 'close', target: this, code: CLOSE_CODES.CLOSE_NORMAL }));

        log('error', ("WebSocket connection to '" + (this.url) + "' failed"));
      }
    }, this);
  }

  if ( EventTarget$$1 ) WebSocket.__proto__ = EventTarget$$1;
  WebSocket.prototype = Object.create( EventTarget$$1 && EventTarget$$1.prototype );
  WebSocket.prototype.constructor = WebSocket;

  var prototypeAccessors = { onopen: {},onmessage: {},onclose: {},onerror: {} };

  prototypeAccessors.onopen.get = function () {
    return this.listeners.open;
  };

  prototypeAccessors.onmessage.get = function () {
    return this.listeners.message;
  };

  prototypeAccessors.onclose.get = function () {
    return this.listeners.close;
  };

  prototypeAccessors.onerror.get = function () {
    return this.listeners.error;
  };

  prototypeAccessors.onopen.set = function (listener) {
    delete this.listeners.open;
    this.addEventListener('open', listener);
  };

  prototypeAccessors.onmessage.set = function (listener) {
    delete this.listeners.message;
    this.addEventListener('message', listener);
  };

  prototypeAccessors.onclose.set = function (listener) {
    delete this.listeners.close;
    this.addEventListener('close', listener);
  };

  prototypeAccessors.onerror.set = function (listener) {
    delete this.listeners.error;
    this.addEventListener('error', listener);
  };

  WebSocket.prototype.send = function send (data) {
    var this$1 = this;

    if (this.readyState === WebSocket.CLOSING || this.readyState === WebSocket.CLOSED) {
      throw new Error('WebSocket is already in CLOSING or CLOSED state');
    }

    // TODO: handle bufferedAmount

    var messageEvent = createMessageEvent({
      type: 'server::message',
      origin: this.url,
      data: normalizeSendData(data)
    });

    var server = networkBridge.serverLookup(this.url);

    if (server) {
      delay(function () {
        this$1.dispatchEvent(messageEvent, data);
      }, server);
    }
  };

  WebSocket.prototype.close = function close (code, reason) {
    if (code !== undefined) {
      if (typeof code !== 'number' || (code !== 1000 && (code < 3000 || code > 4999))) {
        throw new TypeError(
          ((ERROR_PREFIX.CLOSE_ERROR) + " The code must be either 1000, or between 3000 and 4999. " + code + " is neither.")
        );
      }
    }

    if (reason !== undefined) {
      var length = lengthInUtf8Bytes(reason);

      if (length > 123) {
        throw new SyntaxError(((ERROR_PREFIX.CLOSE_ERROR) + " The message must not be greater than 123 bytes."));
      }
    }

    if (this.readyState === WebSocket.CLOSING || this.readyState === WebSocket.CLOSED) {
      return;
    }

    if (this.readyState === WebSocket.CONNECTING) {
      failWebSocketConnection(this, code, reason);
    } else {
      closeWebSocketConnection(this, code, reason);
    }
  };

  Object.defineProperties( WebSocket.prototype, prototypeAccessors );

  return WebSocket;
}(EventTarget));

WebSocket$1.CONNECTING = 0;
WebSocket$1.prototype.CONNECTING = WebSocket$1.CONNECTING;
WebSocket$1.OPEN = 1;
WebSocket$1.prototype.OPEN = WebSocket$1.OPEN;
WebSocket$1.CLOSING = 2;
WebSocket$1.prototype.CLOSING = WebSocket$1.CLOSING;
WebSocket$1.CLOSED = 3;
WebSocket$1.prototype.CLOSED = WebSocket$1.CLOSED;

var dedupe = function (arr) { return arr.reduce(function (deduped, b) {
    if (deduped.indexOf(b) > -1) { return deduped; }
    return deduped.concat(b);
  }, []); };

function retrieveGlobalObject() {
  if (typeof window !== 'undefined') {
    return window;
  }

  return typeof process === 'object' && typeof require === 'function' && typeof global === 'object' ? global : this;
}

var Server$1 = (function (EventTarget$$1) {
  function Server(url, options) {
    if ( options === void 0 ) options = {};

    EventTarget$$1.call(this);
    var urlRecord = new urlParse(url);

    if (!urlRecord.pathname) {
      urlRecord.pathname = '/';
    }

    this.url = urlRecord.toString();

    this.originalWebSocket = null;
    var server = networkBridge.attachServer(this, this.url);

    if (!server) {
      this.dispatchEvent(createEvent({ type: 'error' }));
      throw new Error('A mock server is already listening on this url');
    }

    if (typeof options.verifyClient === 'undefined') {
      options.verifyClient = null;
    }

    if (typeof options.selectProtocol === 'undefined') {
      options.selectProtocol = null;
    }

    this.options = options;
    this.start();
  }

  if ( EventTarget$$1 ) Server.__proto__ = EventTarget$$1;
  Server.prototype = Object.create( EventTarget$$1 && EventTarget$$1.prototype );
  Server.prototype.constructor = Server;

  /*
   * Attaches the mock websocket object to the global object
   */
  Server.prototype.start = function start () {
    var globalObj = retrieveGlobalObject();

    if (globalObj.WebSocket) {
      this.originalWebSocket = globalObj.WebSocket;
    }

    globalObj.WebSocket = WebSocket$1;
  };

  /*
   * Removes the mock websocket object from the global object
   */
  Server.prototype.stop = function stop (callback) {
    if ( callback === void 0 ) callback = function () {};

    var globalObj = retrieveGlobalObject();

    if (this.originalWebSocket) {
      globalObj.WebSocket = this.originalWebSocket;
    } else {
      delete globalObj.WebSocket;
    }

    this.originalWebSocket = null;

    networkBridge.removeServer(this.url);

    if (typeof callback === 'function') {
      callback();
    }
  };

  /*
   * This is the main function for the mock server to subscribe to the on events.
   *
   * ie: mockServer.on('connection', function() { console.log('a mock client connected'); });
   *
   * @param {string} type - The event key to subscribe to. Valid keys are: connection, message, and close.
   * @param {function} callback - The callback which should be called when a certain event is fired.
   */
  Server.prototype.on = function on (type, callback) {
    this.addEventListener(type, callback);
  };

  /*
   * Closes the connection and triggers the onclose method of all listening
   * websockets. After that it removes itself from the urlMap so another server
   * could add itself to the url.
   *
   * @param {object} options
   */
  Server.prototype.close = function close (options) {
    if ( options === void 0 ) options = {};

    var code = options.code;
    var reason = options.reason;
    var wasClean = options.wasClean;
    var listeners = networkBridge.websocketsLookup(this.url);

    // Remove server before notifications to prevent immediate reconnects from
    // socket onclose handlers
    networkBridge.removeServer(this.url);

    listeners.forEach(function (socket) {
      socket.readyState = WebSocket$1.CLOSE;
      socket.dispatchEvent(
        createCloseEvent({
          type: 'close',
          target: socket,
          code: code || CLOSE_CODES.CLOSE_NORMAL,
          reason: reason || '',
          wasClean: wasClean
        })
      );
    });

    this.dispatchEvent(createCloseEvent({ type: 'close' }), this);
  };

  /*
   * Sends a generic message event to all mock clients.
   */
  Server.prototype.emit = function emit (event, data, options) {
    var this$1 = this;
    if ( options === void 0 ) options = {};

    var websockets = options.websockets;

    if (!websockets) {
      websockets = networkBridge.websocketsLookup(this.url);
    }

    if (typeof options !== 'object' || arguments.length > 3) {
      data = Array.prototype.slice.call(arguments, 1, arguments.length);
      data = data.map(function (item) { return normalizeSendData(item); });
    } else {
      data = normalizeSendData(data);
    }

    websockets.forEach(function (socket) {
      if (Array.isArray(data)) {
        socket.dispatchEvent.apply(
          socket, [ createMessageEvent({
            type: event,
            data: data,
            origin: this$1.url,
            target: socket
          }) ].concat( data )
        );
      } else {
        socket.dispatchEvent(
          createMessageEvent({
            type: event,
            data: data,
            origin: this$1.url,
            target: socket
          })
        );
      }
    });
  };

  /*
   * Returns an array of websockets which are listening to this server
   * TOOD: this should return a set and not be a method
   */
  Server.prototype.clients = function clients () {
    return networkBridge.websocketsLookup(this.url);
  };

  /*
   * Prepares a method to submit an event to members of the room
   *
   * e.g. server.to('my-room').emit('hi!');
   */
  Server.prototype.to = function to (room, broadcaster, broadcastList) {
    var this$1 = this;
    if ( broadcastList === void 0 ) broadcastList = [];

    var self = this;
    var websockets = dedupe(broadcastList.concat(networkBridge.websocketsLookup(this.url, room, broadcaster)));

    return {
      to: function (chainedRoom, chainedBroadcaster) { return this$1.to.call(this$1, chainedRoom, chainedBroadcaster, websockets); },
      emit: function emit(event, data) {
        self.emit(event, data, { websockets: websockets });
      }
    };
  };

  /*
   * Alias for Server.to
   */
  Server.prototype.in = function in$1 () {
    var args = [], len = arguments.length;
    while ( len-- ) args[ len ] = arguments[ len ];

    return this.to.apply(null, args);
  };

  /*
   * Simulate an event from the server to the clients. Useful for
   * simulating errors.
   */
  Server.prototype.simulate = function simulate (event) {
    var listeners = networkBridge.websocketsLookup(this.url);

    if (event === 'error') {
      listeners.forEach(function (socket) {
        socket.readyState = WebSocket$1.CLOSE;
        socket.dispatchEvent(createEvent({ type: 'error' }));
      });
    }
  };

  return Server;
}(EventTarget));

/*
 * Alternative constructor to support namespaces in socket.io
 *
 * http://socket.io/docs/rooms-and-namespaces/#custom-namespaces
 */
Server$1.of = function of(url) {
  return new Server$1(url);
};

/*
 * The socket-io class is designed to mimick the real API as closely as possible.
 *
 * http://socket.io/docs/
 */
var SocketIO$1 = (function (EventTarget$$1) {
  function SocketIO(url, protocol) {
    var this$1 = this;
    if ( url === void 0 ) url = 'socket.io';
    if ( protocol === void 0 ) protocol = '';

    EventTarget$$1.call(this);

    this.binaryType = 'blob';
    var urlRecord = new urlParse(url);

    if (!urlRecord.pathname) {
      urlRecord.pathname = '/';
    }

    this.url = urlRecord.toString();
    this.readyState = SocketIO.CONNECTING;
    this.protocol = '';

    if (typeof protocol === 'string' || (typeof protocol === 'object' && protocol !== null)) {
      this.protocol = protocol;
    } else if (Array.isArray(protocol) && protocol.length > 0) {
      this.protocol = protocol[0];
    }

    var server = networkBridge.attachWebSocket(this, this.url);

    /*
     * Delay triggering the connection events so they can be defined in time.
     */
    delay(function delayCallback() {
      if (server) {
        this.readyState = SocketIO.OPEN;
        server.dispatchEvent(createEvent({ type: 'connection' }), server, this);
        server.dispatchEvent(createEvent({ type: 'connect' }), server, this); // alias
        this.dispatchEvent(createEvent({ type: 'connect', target: this }));
      } else {
        this.readyState = SocketIO.CLOSED;
        this.dispatchEvent(createEvent({ type: 'error', target: this }));
        this.dispatchEvent(
          createCloseEvent({
            type: 'close',
            target: this,
            code: CLOSE_CODES.CLOSE_NORMAL
          })
        );

        log('error', ("Socket.io connection to '" + (this.url) + "' failed"));
      }
    }, this);

    /**
      Add an aliased event listener for close / disconnect
     */
    this.addEventListener('close', function (event) {
      this$1.dispatchEvent(
        createCloseEvent({
          type: 'disconnect',
          target: event.target,
          code: event.code
        })
      );
    });
  }

  if ( EventTarget$$1 ) SocketIO.__proto__ = EventTarget$$1;
  SocketIO.prototype = Object.create( EventTarget$$1 && EventTarget$$1.prototype );
  SocketIO.prototype.constructor = SocketIO;

  var prototypeAccessors = { broadcast: {} };

  /*
   * Closes the SocketIO connection or connection attempt, if any.
   * If the connection is already CLOSED, this method does nothing.
   */
  SocketIO.prototype.close = function close () {
    if (this.readyState !== SocketIO.OPEN) {
      return undefined;
    }

    var server = networkBridge.serverLookup(this.url);
    networkBridge.removeWebSocket(this, this.url);

    this.readyState = SocketIO.CLOSED;
    this.dispatchEvent(
      createCloseEvent({
        type: 'close',
        target: this,
        code: CLOSE_CODES.CLOSE_NORMAL
      })
    );

    if (server) {
      server.dispatchEvent(
        createCloseEvent({
          type: 'disconnect',
          target: this,
          code: CLOSE_CODES.CLOSE_NORMAL
        }),
        server
      );
    }

    return this;
  };

  /*
   * Alias for Socket#close
   *
   * https://github.com/socketio/socket.io-client/blob/master/lib/socket.js#L383
   */
  SocketIO.prototype.disconnect = function disconnect () {
    return this.close();
  };

  /*
   * Submits an event to the server with a payload
   */
  SocketIO.prototype.emit = function emit (event) {
    var data = [], len = arguments.length - 1;
    while ( len-- > 0 ) data[ len ] = arguments[ len + 1 ];

    if (this.readyState !== SocketIO.OPEN) {
      throw new Error('SocketIO is already in CLOSING or CLOSED state');
    }

    var messageEvent = createMessageEvent({
      type: event,
      origin: this.url,
      data: data
    });

    var server = networkBridge.serverLookup(this.url);

    if (server) {
      server.dispatchEvent.apply(server, [ messageEvent ].concat( data ));
    }

    return this;
  };

  /*
   * Submits a 'message' event to the server.
   *
   * Should behave exactly like WebSocket#send
   *
   * https://github.com/socketio/socket.io-client/blob/master/lib/socket.js#L113
   */
  SocketIO.prototype.send = function send (data) {
    this.emit('message', data);
    return this;
  };

  /*
   * For broadcasting events to other connected sockets.
   *
   * e.g. socket.broadcast.emit('hi!');
   * e.g. socket.broadcast.to('my-room').emit('hi!');
   */
  prototypeAccessors.broadcast.get = function () {
    if (this.readyState !== SocketIO.OPEN) {
      throw new Error('SocketIO is already in CLOSING or CLOSED state');
    }

    var self = this;
    var server = networkBridge.serverLookup(this.url);
    if (!server) {
      throw new Error(("SocketIO can not find a server at the specified URL (" + (this.url) + ")"));
    }

    return {
      emit: function emit(event, data) {
        server.emit(event, data, { websockets: networkBridge.websocketsLookup(self.url, null, self) });
        return self;
      },
      to: function to(room) {
        return server.to(room, self);
      },
      in: function in$1(room) {
        return server.in(room, self);
      }
    };
  };

  /*
   * For registering events to be received from the server
   */
  SocketIO.prototype.on = function on (type, callback) {
    this.addEventListener(type, callback);
    return this;
  };

  /*
   * Remove event listener
   *
   * https://socket.io/docs/client-api/#socket-on-eventname-callback
   */
  SocketIO.prototype.off = function off (type) {
    this.removeEventListener(type);
  };

  /*
   * Join a room on a server
   *
   * http://socket.io/docs/rooms-and-namespaces/#joining-and-leaving
   */
  SocketIO.prototype.join = function join (room) {
    networkBridge.addMembershipToRoom(this, room);
  };

  /*
   * Get the websocket to leave the room
   *
   * http://socket.io/docs/rooms-and-namespaces/#joining-and-leaving
   */
  SocketIO.prototype.leave = function leave (room) {
    networkBridge.removeMembershipFromRoom(this, room);
  };

  SocketIO.prototype.to = function to (room) {
    return this.broadcast.to(room);
  };

  SocketIO.prototype.in = function in$1 () {
    return this.to.apply(null, arguments);
  };

  /*
   * Invokes all listener functions that are listening to the given event.type property. Each
   * listener will be passed the event as the first argument.
   *
   * @param {object} event - event object which will be passed to all listeners of the event.type property
   */
  SocketIO.prototype.dispatchEvent = function dispatchEvent (event) {
    var this$1 = this;
    var customArguments = [], len = arguments.length - 1;
    while ( len-- > 0 ) customArguments[ len ] = arguments[ len + 1 ];

    var eventName = event.type;
    var listeners = this.listeners[eventName];

    if (!Array.isArray(listeners)) {
      return false;
    }

    listeners.forEach(function (listener) {
      if (customArguments.length > 0) {
        listener.apply(this$1, customArguments);
      } else {
        // Regular WebSockets expect a MessageEvent but Socketio.io just wants raw data
        //  payload instanceof MessageEvent works, but you can't isntance of NodeEvent
        //  for now we detect if the output has data defined on it
        listener.call(this$1, event.data ? event.data : event);
      }
    });
  };

  Object.defineProperties( SocketIO.prototype, prototypeAccessors );

  return SocketIO;
}(EventTarget));

SocketIO$1.CONNECTING = 0;
SocketIO$1.OPEN = 1;
SocketIO$1.CLOSING = 2;
SocketIO$1.CLOSED = 3;

/*
 * Static constructor methods for the IO Socket
 */
var IO = function ioConstructor(url, protocol) {
  return new SocketIO$1(url, protocol);
};

/*
 * Alias the raw IO() constructor
 */
IO.connect = function ioConnect(url, protocol) {
  /* eslint-disable new-cap */
  return IO(url, protocol);
  /* eslint-enable new-cap */
};

var Server = Server$1;
var WebSocket = WebSocket$1;
var SocketIO = IO;

exports.Server = Server;
exports.WebSocket = WebSocket;
exports.SocketIO = SocketIO;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9jay1zb2NrZXQuY2pzLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvcmVxdWlyZXMtcG9ydC9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9xdWVyeXN0cmluZ2lmeS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy91cmwtcGFyc2UvaW5kZXguanMiLCIuLi9zcmMvaGVscGVycy9kZWxheS5qcyIsIi4uL3NyYy9oZWxwZXJzL2xvZ2dlci5qcyIsIi4uL3NyYy9oZWxwZXJzL2FycmF5LWhlbHBlcnMuanMiLCIuLi9zcmMvZXZlbnQvdGFyZ2V0LmpzIiwiLi4vc3JjL25ldHdvcmstYnJpZGdlLmpzIiwiLi4vc3JjL2NvbnN0YW50cy5qcyIsIi4uL3NyYy9ldmVudC9wcm90b3R5cGUuanMiLCIuLi9zcmMvZXZlbnQvZXZlbnQuanMiLCIuLi9zcmMvZXZlbnQvbWVzc2FnZS5qcyIsIi4uL3NyYy9ldmVudC9jbG9zZS5qcyIsIi4uL3NyYy9ldmVudC9mYWN0b3J5LmpzIiwiLi4vc3JjL2FsZ29yaXRobXMvY2xvc2UuanMiLCIuLi9zcmMvaGVscGVycy9ub3JtYWxpemUtc2VuZC5qcyIsIi4uL3NyYy9oZWxwZXJzL3Byb3h5LWZhY3RvcnkuanMiLCIuLi9zcmMvaGVscGVycy9ieXRlLWxlbmd0aC5qcyIsIi4uL3NyYy9oZWxwZXJzL3VybC12ZXJpZmljYXRpb24uanMiLCIuLi9zcmMvaGVscGVycy9wcm90b2NvbC12ZXJpZmljYXRpb24uanMiLCIuLi9zcmMvd2Vic29ja2V0LmpzIiwiLi4vc3JjL2hlbHBlcnMvZGVkdXBlLmpzIiwiLi4vc3JjL2hlbHBlcnMvZ2xvYmFsLW9iamVjdC5qcyIsIi4uL3NyYy9zZXJ2ZXIuanMiLCIuLi9zcmMvc29ja2V0LWlvLmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBDaGVjayBpZiB3ZSdyZSByZXF1aXJlZCB0byBhZGQgYSBwb3J0IG51bWJlci5cbiAqXG4gKiBAc2VlIGh0dHBzOi8vdXJsLnNwZWMud2hhdHdnLm9yZy8jZGVmYXVsdC1wb3J0XG4gKiBAcGFyYW0ge051bWJlcnxTdHJpbmd9IHBvcnQgUG9ydCBudW1iZXIgd2UgbmVlZCB0byBjaGVja1xuICogQHBhcmFtIHtTdHJpbmd9IHByb3RvY29sIFByb3RvY29sIHdlIG5lZWQgdG8gY2hlY2sgYWdhaW5zdC5cbiAqIEByZXR1cm5zIHtCb29sZWFufSBJcyBpdCBhIGRlZmF1bHQgcG9ydCBmb3IgdGhlIGdpdmVuIHByb3RvY29sXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiByZXF1aXJlZChwb3J0LCBwcm90b2NvbCkge1xuICBwcm90b2NvbCA9IHByb3RvY29sLnNwbGl0KCc6JylbMF07XG4gIHBvcnQgPSArcG9ydDtcblxuICBpZiAoIXBvcnQpIHJldHVybiBmYWxzZTtcblxuICBzd2l0Y2ggKHByb3RvY29sKSB7XG4gICAgY2FzZSAnaHR0cCc6XG4gICAgY2FzZSAnd3MnOlxuICAgIHJldHVybiBwb3J0ICE9PSA4MDtcblxuICAgIGNhc2UgJ2h0dHBzJzpcbiAgICBjYXNlICd3c3MnOlxuICAgIHJldHVybiBwb3J0ICE9PSA0NDM7XG5cbiAgICBjYXNlICdmdHAnOlxuICAgIHJldHVybiBwb3J0ICE9PSAyMTtcblxuICAgIGNhc2UgJ2dvcGhlcic6XG4gICAgcmV0dXJuIHBvcnQgIT09IDcwO1xuXG4gICAgY2FzZSAnZmlsZSc6XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIHBvcnQgIT09IDA7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaGFzID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eVxuICAsIHVuZGVmO1xuXG4vKipcbiAqIERlY29kZSBhIFVSSSBlbmNvZGVkIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIFVSSSBlbmNvZGVkIHN0cmluZy5cbiAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBkZWNvZGVkIHN0cmluZy5cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBkZWNvZGUoaW5wdXQpIHtcbiAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChpbnB1dC5yZXBsYWNlKC9cXCsvZywgJyAnKSk7XG59XG5cbi8qKlxuICogU2ltcGxlIHF1ZXJ5IHN0cmluZyBwYXJzZXIuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHF1ZXJ5IFRoZSBxdWVyeSBzdHJpbmcgdGhhdCBuZWVkcyB0byBiZSBwYXJzZWQuXG4gKiBAcmV0dXJucyB7T2JqZWN0fVxuICogQGFwaSBwdWJsaWNcbiAqL1xuZnVuY3Rpb24gcXVlcnlzdHJpbmcocXVlcnkpIHtcbiAgdmFyIHBhcnNlciA9IC8oW149PyZdKyk9PyhbXiZdKikvZ1xuICAgICwgcmVzdWx0ID0ge31cbiAgICAsIHBhcnQ7XG5cbiAgd2hpbGUgKHBhcnQgPSBwYXJzZXIuZXhlYyhxdWVyeSkpIHtcbiAgICB2YXIga2V5ID0gZGVjb2RlKHBhcnRbMV0pXG4gICAgICAsIHZhbHVlID0gZGVjb2RlKHBhcnRbMl0pO1xuXG4gICAgLy9cbiAgICAvLyBQcmV2ZW50IG92ZXJyaWRpbmcgb2YgZXhpc3RpbmcgcHJvcGVydGllcy4gVGhpcyBlbnN1cmVzIHRoYXQgYnVpbGQtaW5cbiAgICAvLyBtZXRob2RzIGxpa2UgYHRvU3RyaW5nYCBvciBfX3Byb3RvX18gYXJlIG5vdCBvdmVycmlkZW4gYnkgbWFsaWNpb3VzXG4gICAgLy8gcXVlcnlzdHJpbmdzLlxuICAgIC8vXG4gICAgaWYgKGtleSBpbiByZXN1bHQpIGNvbnRpbnVlO1xuICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBhIHF1ZXJ5IHN0cmluZyB0byBhbiBvYmplY3QuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iaiBPYmplY3QgdGhhdCBzaG91bGQgYmUgdHJhbnNmb3JtZWQuXG4gKiBAcGFyYW0ge1N0cmluZ30gcHJlZml4IE9wdGlvbmFsIHByZWZpeC5cbiAqIEByZXR1cm5zIHtTdHJpbmd9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5mdW5jdGlvbiBxdWVyeXN0cmluZ2lmeShvYmosIHByZWZpeCkge1xuICBwcmVmaXggPSBwcmVmaXggfHwgJyc7XG5cbiAgdmFyIHBhaXJzID0gW11cbiAgICAsIHZhbHVlXG4gICAgLCBrZXk7XG5cbiAgLy9cbiAgLy8gT3B0aW9uYWxseSBwcmVmaXggd2l0aCBhICc/JyBpZiBuZWVkZWRcbiAgLy9cbiAgaWYgKCdzdHJpbmcnICE9PSB0eXBlb2YgcHJlZml4KSBwcmVmaXggPSAnPyc7XG5cbiAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgaWYgKGhhcy5jYWxsKG9iaiwga2V5KSkge1xuICAgICAgdmFsdWUgPSBvYmpba2V5XTtcblxuICAgICAgLy9cbiAgICAgIC8vIEVkZ2UgY2FzZXMgd2hlcmUgd2UgYWN0dWFsbHkgd2FudCB0byBlbmNvZGUgdGhlIHZhbHVlIHRvIGFuIGVtcHR5XG4gICAgICAvLyBzdHJpbmcgaW5zdGVhZCBvZiB0aGUgc3RyaW5naWZpZWQgdmFsdWUuXG4gICAgICAvL1xuICAgICAgaWYgKCF2YWx1ZSAmJiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmIHx8IGlzTmFOKHZhbHVlKSkpIHtcbiAgICAgICAgdmFsdWUgPSAnJztcbiAgICAgIH1cblxuICAgICAgcGFpcnMucHVzaChlbmNvZGVVUklDb21wb25lbnQoa2V5KSArJz0nKyBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGFpcnMubGVuZ3RoID8gcHJlZml4ICsgcGFpcnMuam9pbignJicpIDogJyc7XG59XG5cbi8vXG4vLyBFeHBvc2UgdGhlIG1vZHVsZS5cbi8vXG5leHBvcnRzLnN0cmluZ2lmeSA9IHF1ZXJ5c3RyaW5naWZ5O1xuZXhwb3J0cy5wYXJzZSA9IHF1ZXJ5c3RyaW5nO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmVxdWlyZWQgPSByZXF1aXJlKCdyZXF1aXJlcy1wb3J0JylcbiAgLCBxcyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5naWZ5JylcbiAgLCBwcm90b2NvbHJlID0gL14oW2Etel1bYS16MC05ListXSo6KT8oXFwvXFwvKT8oW1xcU1xcc10qKS9pXG4gICwgc2xhc2hlcyA9IC9eW0EtWmEtel1bQS1aYS16MC05Ky0uXSo6XFwvXFwvLztcblxuLyoqXG4gKiBUaGVzZSBhcmUgdGhlIHBhcnNlIHJ1bGVzIGZvciB0aGUgVVJMIHBhcnNlciwgaXQgaW5mb3JtcyB0aGUgcGFyc2VyXG4gKiBhYm91dDpcbiAqXG4gKiAwLiBUaGUgY2hhciBpdCBOZWVkcyB0byBwYXJzZSwgaWYgaXQncyBhIHN0cmluZyBpdCBzaG91bGQgYmUgZG9uZSB1c2luZ1xuICogICAgaW5kZXhPZiwgUmVnRXhwIHVzaW5nIGV4ZWMgYW5kIE5hTiBtZWFucyBzZXQgYXMgY3VycmVudCB2YWx1ZS5cbiAqIDEuIFRoZSBwcm9wZXJ0eSB3ZSBzaG91bGQgc2V0IHdoZW4gcGFyc2luZyB0aGlzIHZhbHVlLlxuICogMi4gSW5kaWNhdGlvbiBpZiBpdCdzIGJhY2t3YXJkcyBvciBmb3J3YXJkIHBhcnNpbmcsIHdoZW4gc2V0IGFzIG51bWJlciBpdCdzXG4gKiAgICB0aGUgdmFsdWUgb2YgZXh0cmEgY2hhcnMgdGhhdCBzaG91bGQgYmUgc3BsaXQgb2ZmLlxuICogMy4gSW5oZXJpdCBmcm9tIGxvY2F0aW9uIGlmIG5vbiBleGlzdGluZyBpbiB0aGUgcGFyc2VyLlxuICogNC4gYHRvTG93ZXJDYXNlYCB0aGUgcmVzdWx0aW5nIHZhbHVlLlxuICovXG52YXIgcnVsZXMgPSBbXG4gIFsnIycsICdoYXNoJ10sICAgICAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBmcm9tIHRoZSBiYWNrLlxuICBbJz8nLCAncXVlcnknXSwgICAgICAgICAgICAgICAgICAgICAgIC8vIEV4dHJhY3QgZnJvbSB0aGUgYmFjay5cbiAgZnVuY3Rpb24gc2FuaXRpemUoYWRkcmVzcykgeyAgICAgICAgICAvLyBTYW5pdGl6ZSB3aGF0IGlzIGxlZnQgb2YgdGhlIGFkZHJlc3NcbiAgICByZXR1cm4gYWRkcmVzcy5yZXBsYWNlKCdcXFxcJywgJy8nKTtcbiAgfSxcbiAgWycvJywgJ3BhdGhuYW1lJ10sICAgICAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IGZyb20gdGhlIGJhY2suXG4gIFsnQCcsICdhdXRoJywgMV0sICAgICAgICAgICAgICAgICAgICAgLy8gRXh0cmFjdCBmcm9tIHRoZSBmcm9udC5cbiAgW05hTiwgJ2hvc3QnLCB1bmRlZmluZWQsIDEsIDFdLCAgICAgICAvLyBTZXQgbGVmdCBvdmVyIHZhbHVlLlxuICBbLzooXFxkKykkLywgJ3BvcnQnLCB1bmRlZmluZWQsIDFdLCAgICAvLyBSZWdFeHAgdGhlIGJhY2suXG4gIFtOYU4sICdob3N0bmFtZScsIHVuZGVmaW5lZCwgMSwgMV0gICAgLy8gU2V0IGxlZnQgb3Zlci5cbl07XG5cbi8qKlxuICogVGhlc2UgcHJvcGVydGllcyBzaG91bGQgbm90IGJlIGNvcGllZCBvciBpbmhlcml0ZWQgZnJvbS4gVGhpcyBpcyBvbmx5IG5lZWRlZFxuICogZm9yIGFsbCBub24gYmxvYiBVUkwncyBhcyBhIGJsb2IgVVJMIGRvZXMgbm90IGluY2x1ZGUgYSBoYXNoLCBvbmx5IHRoZVxuICogb3JpZ2luLlxuICpcbiAqIEB0eXBlIHtPYmplY3R9XG4gKiBAcHJpdmF0ZVxuICovXG52YXIgaWdub3JlID0geyBoYXNoOiAxLCBxdWVyeTogMSB9O1xuXG4vKipcbiAqIFRoZSBsb2NhdGlvbiBvYmplY3QgZGlmZmVycyB3aGVuIHlvdXIgY29kZSBpcyBsb2FkZWQgdGhyb3VnaCBhIG5vcm1hbCBwYWdlLFxuICogV29ya2VyIG9yIHRocm91Z2ggYSB3b3JrZXIgdXNpbmcgYSBibG9iLiBBbmQgd2l0aCB0aGUgYmxvYmJsZSBiZWdpbnMgdGhlXG4gKiB0cm91YmxlIGFzIHRoZSBsb2NhdGlvbiBvYmplY3Qgd2lsbCBjb250YWluIHRoZSBVUkwgb2YgdGhlIGJsb2IsIG5vdCB0aGVcbiAqIGxvY2F0aW9uIG9mIHRoZSBwYWdlIHdoZXJlIG91ciBjb2RlIGlzIGxvYWRlZCBpbi4gVGhlIGFjdHVhbCBvcmlnaW4gaXNcbiAqIGVuY29kZWQgaW4gdGhlIGBwYXRobmFtZWAgc28gd2UgY2FuIHRoYW5rZnVsbHkgZ2VuZXJhdGUgYSBnb29kIFwiZGVmYXVsdFwiXG4gKiBsb2NhdGlvbiBmcm9tIGl0IHNvIHdlIGNhbiBnZW5lcmF0ZSBwcm9wZXIgcmVsYXRpdmUgVVJMJ3MgYWdhaW4uXG4gKlxuICogQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBsb2MgT3B0aW9uYWwgZGVmYXVsdCBsb2NhdGlvbiBvYmplY3QuXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBsb2xjYXRpb24gb2JqZWN0LlxuICogQHB1YmxpY1xuICovXG5mdW5jdGlvbiBsb2xjYXRpb24obG9jKSB7XG4gIHZhciBnbG9iYWxWYXI7XG5cbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSBnbG9iYWxWYXIgPSB3aW5kb3c7XG4gIGVsc2UgaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSBnbG9iYWxWYXIgPSBnbG9iYWw7XG4gIGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykgZ2xvYmFsVmFyID0gc2VsZjtcbiAgZWxzZSBnbG9iYWxWYXIgPSB7fTtcblxuICB2YXIgbG9jYXRpb24gPSBnbG9iYWxWYXIubG9jYXRpb24gfHwge307XG4gIGxvYyA9IGxvYyB8fCBsb2NhdGlvbjtcblxuICB2YXIgZmluYWxkZXN0aW5hdGlvbiA9IHt9XG4gICAgLCB0eXBlID0gdHlwZW9mIGxvY1xuICAgICwga2V5O1xuXG4gIGlmICgnYmxvYjonID09PSBsb2MucHJvdG9jb2wpIHtcbiAgICBmaW5hbGRlc3RpbmF0aW9uID0gbmV3IFVybCh1bmVzY2FwZShsb2MucGF0aG5hbWUpLCB7fSk7XG4gIH0gZWxzZSBpZiAoJ3N0cmluZycgPT09IHR5cGUpIHtcbiAgICBmaW5hbGRlc3RpbmF0aW9uID0gbmV3IFVybChsb2MsIHt9KTtcbiAgICBmb3IgKGtleSBpbiBpZ25vcmUpIGRlbGV0ZSBmaW5hbGRlc3RpbmF0aW9uW2tleV07XG4gIH0gZWxzZSBpZiAoJ29iamVjdCcgPT09IHR5cGUpIHtcbiAgICBmb3IgKGtleSBpbiBsb2MpIHtcbiAgICAgIGlmIChrZXkgaW4gaWdub3JlKSBjb250aW51ZTtcbiAgICAgIGZpbmFsZGVzdGluYXRpb25ba2V5XSA9IGxvY1trZXldO1xuICAgIH1cblxuICAgIGlmIChmaW5hbGRlc3RpbmF0aW9uLnNsYXNoZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZmluYWxkZXN0aW5hdGlvbi5zbGFzaGVzID0gc2xhc2hlcy50ZXN0KGxvYy5ocmVmKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmluYWxkZXN0aW5hdGlvbjtcbn1cblxuLyoqXG4gKiBAdHlwZWRlZiBQcm90b2NvbEV4dHJhY3RcbiAqIEB0eXBlIE9iamVjdFxuICogQHByb3BlcnR5IHtTdHJpbmd9IHByb3RvY29sIFByb3RvY29sIG1hdGNoZWQgaW4gdGhlIFVSTCwgaW4gbG93ZXJjYXNlLlxuICogQHByb3BlcnR5IHtCb29sZWFufSBzbGFzaGVzIGB0cnVlYCBpZiBwcm90b2NvbCBpcyBmb2xsb3dlZCBieSBcIi8vXCIsIGVsc2UgYGZhbHNlYC5cbiAqIEBwcm9wZXJ0eSB7U3RyaW5nfSByZXN0IFJlc3Qgb2YgdGhlIFVSTCB0aGF0IGlzIG5vdCBwYXJ0IG9mIHRoZSBwcm90b2NvbC5cbiAqL1xuXG4vKipcbiAqIEV4dHJhY3QgcHJvdG9jb2wgaW5mb3JtYXRpb24gZnJvbSBhIFVSTCB3aXRoL3dpdGhvdXQgZG91YmxlIHNsYXNoIChcIi8vXCIpLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBhZGRyZXNzIFVSTCB3ZSB3YW50IHRvIGV4dHJhY3QgZnJvbS5cbiAqIEByZXR1cm4ge1Byb3RvY29sRXh0cmFjdH0gRXh0cmFjdGVkIGluZm9ybWF0aW9uLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZXh0cmFjdFByb3RvY29sKGFkZHJlc3MpIHtcbiAgdmFyIG1hdGNoID0gcHJvdG9jb2xyZS5leGVjKGFkZHJlc3MpO1xuXG4gIHJldHVybiB7XG4gICAgcHJvdG9jb2w6IG1hdGNoWzFdID8gbWF0Y2hbMV0udG9Mb3dlckNhc2UoKSA6ICcnLFxuICAgIHNsYXNoZXM6ICEhbWF0Y2hbMl0sXG4gICAgcmVzdDogbWF0Y2hbM11cbiAgfTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGEgcmVsYXRpdmUgVVJMIHBhdGhuYW1lIGFnYWluc3QgYSBiYXNlIFVSTCBwYXRobmFtZS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcmVsYXRpdmUgUGF0aG5hbWUgb2YgdGhlIHJlbGF0aXZlIFVSTC5cbiAqIEBwYXJhbSB7U3RyaW5nfSBiYXNlIFBhdGhuYW1lIG9mIHRoZSBiYXNlIFVSTC5cbiAqIEByZXR1cm4ge1N0cmluZ30gUmVzb2x2ZWQgcGF0aG5hbWUuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiByZXNvbHZlKHJlbGF0aXZlLCBiYXNlKSB7XG4gIHZhciBwYXRoID0gKGJhc2UgfHwgJy8nKS5zcGxpdCgnLycpLnNsaWNlKDAsIC0xKS5jb25jYXQocmVsYXRpdmUuc3BsaXQoJy8nKSlcbiAgICAsIGkgPSBwYXRoLmxlbmd0aFxuICAgICwgbGFzdCA9IHBhdGhbaSAtIDFdXG4gICAgLCB1bnNoaWZ0ID0gZmFsc2VcbiAgICAsIHVwID0gMDtcblxuICB3aGlsZSAoaS0tKSB7XG4gICAgaWYgKHBhdGhbaV0gPT09ICcuJykge1xuICAgICAgcGF0aC5zcGxpY2UoaSwgMSk7XG4gICAgfSBlbHNlIGlmIChwYXRoW2ldID09PSAnLi4nKSB7XG4gICAgICBwYXRoLnNwbGljZShpLCAxKTtcbiAgICAgIHVwKys7XG4gICAgfSBlbHNlIGlmICh1cCkge1xuICAgICAgaWYgKGkgPT09IDApIHVuc2hpZnQgPSB0cnVlO1xuICAgICAgcGF0aC5zcGxpY2UoaSwgMSk7XG4gICAgICB1cC0tO1xuICAgIH1cbiAgfVxuXG4gIGlmICh1bnNoaWZ0KSBwYXRoLnVuc2hpZnQoJycpO1xuICBpZiAobGFzdCA9PT0gJy4nIHx8IGxhc3QgPT09ICcuLicpIHBhdGgucHVzaCgnJyk7XG5cbiAgcmV0dXJuIHBhdGguam9pbignLycpO1xufVxuXG4vKipcbiAqIFRoZSBhY3R1YWwgVVJMIGluc3RhbmNlLiBJbnN0ZWFkIG9mIHJldHVybmluZyBhbiBvYmplY3Qgd2UndmUgb3B0ZWQtaW4gdG9cbiAqIGNyZWF0ZSBhbiBhY3R1YWwgY29uc3RydWN0b3IgYXMgaXQncyBtdWNoIG1vcmUgbWVtb3J5IGVmZmljaWVudCBhbmRcbiAqIGZhc3RlciBhbmQgaXQgcGxlYXNlcyBteSBPQ0QuXG4gKlxuICogSXQgaXMgd29ydGggbm90aW5nIHRoYXQgd2Ugc2hvdWxkIG5vdCB1c2UgYFVSTGAgYXMgY2xhc3MgbmFtZSB0byBwcmV2ZW50XG4gKiBjbGFzaGVzIHdpdGggdGhlIGdsb2JhbCBVUkwgaW5zdGFuY2UgdGhhdCBnb3QgaW50cm9kdWNlZCBpbiBicm93c2Vycy5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7U3RyaW5nfSBhZGRyZXNzIFVSTCB3ZSB3YW50IHRvIHBhcnNlLlxuICogQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBbbG9jYXRpb25dIExvY2F0aW9uIGRlZmF1bHRzIGZvciByZWxhdGl2ZSBwYXRocy5cbiAqIEBwYXJhbSB7Qm9vbGVhbnxGdW5jdGlvbn0gW3BhcnNlcl0gUGFyc2VyIGZvciB0aGUgcXVlcnkgc3RyaW5nLlxuICogQHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gVXJsKGFkZHJlc3MsIGxvY2F0aW9uLCBwYXJzZXIpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFVybCkpIHtcbiAgICByZXR1cm4gbmV3IFVybChhZGRyZXNzLCBsb2NhdGlvbiwgcGFyc2VyKTtcbiAgfVxuXG4gIHZhciByZWxhdGl2ZSwgZXh0cmFjdGVkLCBwYXJzZSwgaW5zdHJ1Y3Rpb24sIGluZGV4LCBrZXlcbiAgICAsIGluc3RydWN0aW9ucyA9IHJ1bGVzLnNsaWNlKClcbiAgICAsIHR5cGUgPSB0eXBlb2YgbG9jYXRpb25cbiAgICAsIHVybCA9IHRoaXNcbiAgICAsIGkgPSAwO1xuXG4gIC8vXG4gIC8vIFRoZSBmb2xsb3dpbmcgaWYgc3RhdGVtZW50cyBhbGxvd3MgdGhpcyBtb2R1bGUgdHdvIGhhdmUgY29tcGF0aWJpbGl0eSB3aXRoXG4gIC8vIDIgZGlmZmVyZW50IEFQSTpcbiAgLy9cbiAgLy8gMS4gTm9kZS5qcydzIGB1cmwucGFyc2VgIGFwaSB3aGljaCBhY2NlcHRzIGEgVVJMLCBib29sZWFuIGFzIGFyZ3VtZW50c1xuICAvLyAgICB3aGVyZSB0aGUgYm9vbGVhbiBpbmRpY2F0ZXMgdGhhdCB0aGUgcXVlcnkgc3RyaW5nIHNob3VsZCBhbHNvIGJlIHBhcnNlZC5cbiAgLy9cbiAgLy8gMi4gVGhlIGBVUkxgIGludGVyZmFjZSBvZiB0aGUgYnJvd3NlciB3aGljaCBhY2NlcHRzIGEgVVJMLCBvYmplY3QgYXNcbiAgLy8gICAgYXJndW1lbnRzLiBUaGUgc3VwcGxpZWQgb2JqZWN0IHdpbGwgYmUgdXNlZCBhcyBkZWZhdWx0IHZhbHVlcyAvIGZhbGwtYmFja1xuICAvLyAgICBmb3IgcmVsYXRpdmUgcGF0aHMuXG4gIC8vXG4gIGlmICgnb2JqZWN0JyAhPT0gdHlwZSAmJiAnc3RyaW5nJyAhPT0gdHlwZSkge1xuICAgIHBhcnNlciA9IGxvY2F0aW9uO1xuICAgIGxvY2F0aW9uID0gbnVsbDtcbiAgfVxuXG4gIGlmIChwYXJzZXIgJiYgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHBhcnNlcikgcGFyc2VyID0gcXMucGFyc2U7XG5cbiAgbG9jYXRpb24gPSBsb2xjYXRpb24obG9jYXRpb24pO1xuXG4gIC8vXG4gIC8vIEV4dHJhY3QgcHJvdG9jb2wgaW5mb3JtYXRpb24gYmVmb3JlIHJ1bm5pbmcgdGhlIGluc3RydWN0aW9ucy5cbiAgLy9cbiAgZXh0cmFjdGVkID0gZXh0cmFjdFByb3RvY29sKGFkZHJlc3MgfHwgJycpO1xuICByZWxhdGl2ZSA9ICFleHRyYWN0ZWQucHJvdG9jb2wgJiYgIWV4dHJhY3RlZC5zbGFzaGVzO1xuICB1cmwuc2xhc2hlcyA9IGV4dHJhY3RlZC5zbGFzaGVzIHx8IHJlbGF0aXZlICYmIGxvY2F0aW9uLnNsYXNoZXM7XG4gIHVybC5wcm90b2NvbCA9IGV4dHJhY3RlZC5wcm90b2NvbCB8fCBsb2NhdGlvbi5wcm90b2NvbCB8fCAnJztcbiAgYWRkcmVzcyA9IGV4dHJhY3RlZC5yZXN0O1xuXG4gIC8vXG4gIC8vIFdoZW4gdGhlIGF1dGhvcml0eSBjb21wb25lbnQgaXMgYWJzZW50IHRoZSBVUkwgc3RhcnRzIHdpdGggYSBwYXRoXG4gIC8vIGNvbXBvbmVudC5cbiAgLy9cbiAgaWYgKCFleHRyYWN0ZWQuc2xhc2hlcykgaW5zdHJ1Y3Rpb25zWzNdID0gWy8oLiopLywgJ3BhdGhuYW1lJ107XG5cbiAgZm9yICg7IGkgPCBpbnN0cnVjdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICBpbnN0cnVjdGlvbiA9IGluc3RydWN0aW9uc1tpXTtcblxuICAgIGlmICh0eXBlb2YgaW5zdHJ1Y3Rpb24gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGFkZHJlc3MgPSBpbnN0cnVjdGlvbihhZGRyZXNzKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHBhcnNlID0gaW5zdHJ1Y3Rpb25bMF07XG4gICAga2V5ID0gaW5zdHJ1Y3Rpb25bMV07XG5cbiAgICBpZiAocGFyc2UgIT09IHBhcnNlKSB7XG4gICAgICB1cmxba2V5XSA9IGFkZHJlc3M7XG4gICAgfSBlbHNlIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIHBhcnNlKSB7XG4gICAgICBpZiAofihpbmRleCA9IGFkZHJlc3MuaW5kZXhPZihwYXJzZSkpKSB7XG4gICAgICAgIGlmICgnbnVtYmVyJyA9PT0gdHlwZW9mIGluc3RydWN0aW9uWzJdKSB7XG4gICAgICAgICAgdXJsW2tleV0gPSBhZGRyZXNzLnNsaWNlKDAsIGluZGV4KTtcbiAgICAgICAgICBhZGRyZXNzID0gYWRkcmVzcy5zbGljZShpbmRleCArIGluc3RydWN0aW9uWzJdKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1cmxba2V5XSA9IGFkZHJlc3Muc2xpY2UoaW5kZXgpO1xuICAgICAgICAgIGFkZHJlc3MgPSBhZGRyZXNzLnNsaWNlKDAsIGluZGV4KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoKGluZGV4ID0gcGFyc2UuZXhlYyhhZGRyZXNzKSkpIHtcbiAgICAgIHVybFtrZXldID0gaW5kZXhbMV07XG4gICAgICBhZGRyZXNzID0gYWRkcmVzcy5zbGljZSgwLCBpbmRleC5pbmRleCk7XG4gICAgfVxuXG4gICAgdXJsW2tleV0gPSB1cmxba2V5XSB8fCAoXG4gICAgICByZWxhdGl2ZSAmJiBpbnN0cnVjdGlvblszXSA/IGxvY2F0aW9uW2tleV0gfHwgJycgOiAnJ1xuICAgICk7XG5cbiAgICAvL1xuICAgIC8vIEhvc3RuYW1lLCBob3N0IGFuZCBwcm90b2NvbCBzaG91bGQgYmUgbG93ZXJjYXNlZCBzbyB0aGV5IGNhbiBiZSB1c2VkIHRvXG4gICAgLy8gY3JlYXRlIGEgcHJvcGVyIGBvcmlnaW5gLlxuICAgIC8vXG4gICAgaWYgKGluc3RydWN0aW9uWzRdKSB1cmxba2V5XSA9IHVybFtrZXldLnRvTG93ZXJDYXNlKCk7XG4gIH1cblxuICAvL1xuICAvLyBBbHNvIHBhcnNlIHRoZSBzdXBwbGllZCBxdWVyeSBzdHJpbmcgaW4gdG8gYW4gb2JqZWN0LiBJZiB3ZSdyZSBzdXBwbGllZFxuICAvLyB3aXRoIGEgY3VzdG9tIHBhcnNlciBhcyBmdW5jdGlvbiB1c2UgdGhhdCBpbnN0ZWFkIG9mIHRoZSBkZWZhdWx0IGJ1aWxkLWluXG4gIC8vIHBhcnNlci5cbiAgLy9cbiAgaWYgKHBhcnNlcikgdXJsLnF1ZXJ5ID0gcGFyc2VyKHVybC5xdWVyeSk7XG5cbiAgLy9cbiAgLy8gSWYgdGhlIFVSTCBpcyByZWxhdGl2ZSwgcmVzb2x2ZSB0aGUgcGF0aG5hbWUgYWdhaW5zdCB0aGUgYmFzZSBVUkwuXG4gIC8vXG4gIGlmIChcbiAgICAgIHJlbGF0aXZlXG4gICAgJiYgbG9jYXRpb24uc2xhc2hlc1xuICAgICYmIHVybC5wYXRobmFtZS5jaGFyQXQoMCkgIT09ICcvJ1xuICAgICYmICh1cmwucGF0aG5hbWUgIT09ICcnIHx8IGxvY2F0aW9uLnBhdGhuYW1lICE9PSAnJylcbiAgKSB7XG4gICAgdXJsLnBhdGhuYW1lID0gcmVzb2x2ZSh1cmwucGF0aG5hbWUsIGxvY2F0aW9uLnBhdGhuYW1lKTtcbiAgfVxuXG4gIC8vXG4gIC8vIFdlIHNob3VsZCBub3QgYWRkIHBvcnQgbnVtYmVycyBpZiB0aGV5IGFyZSBhbHJlYWR5IHRoZSBkZWZhdWx0IHBvcnQgbnVtYmVyXG4gIC8vIGZvciBhIGdpdmVuIHByb3RvY29sLiBBcyB0aGUgaG9zdCBhbHNvIGNvbnRhaW5zIHRoZSBwb3J0IG51bWJlciB3ZSdyZSBnb2luZ1xuICAvLyBvdmVycmlkZSBpdCB3aXRoIHRoZSBob3N0bmFtZSB3aGljaCBjb250YWlucyBubyBwb3J0IG51bWJlci5cbiAgLy9cbiAgaWYgKCFyZXF1aXJlZCh1cmwucG9ydCwgdXJsLnByb3RvY29sKSkge1xuICAgIHVybC5ob3N0ID0gdXJsLmhvc3RuYW1lO1xuICAgIHVybC5wb3J0ID0gJyc7XG4gIH1cblxuICAvL1xuICAvLyBQYXJzZSBkb3duIHRoZSBgYXV0aGAgZm9yIHRoZSB1c2VybmFtZSBhbmQgcGFzc3dvcmQuXG4gIC8vXG4gIHVybC51c2VybmFtZSA9IHVybC5wYXNzd29yZCA9ICcnO1xuICBpZiAodXJsLmF1dGgpIHtcbiAgICBpbnN0cnVjdGlvbiA9IHVybC5hdXRoLnNwbGl0KCc6Jyk7XG4gICAgdXJsLnVzZXJuYW1lID0gaW5zdHJ1Y3Rpb25bMF0gfHwgJyc7XG4gICAgdXJsLnBhc3N3b3JkID0gaW5zdHJ1Y3Rpb25bMV0gfHwgJyc7XG4gIH1cblxuICB1cmwub3JpZ2luID0gdXJsLnByb3RvY29sICYmIHVybC5ob3N0ICYmIHVybC5wcm90b2NvbCAhPT0gJ2ZpbGU6J1xuICAgID8gdXJsLnByb3RvY29sICsnLy8nKyB1cmwuaG9zdFxuICAgIDogJ251bGwnO1xuXG4gIC8vXG4gIC8vIFRoZSBocmVmIGlzIGp1c3QgdGhlIGNvbXBpbGVkIHJlc3VsdC5cbiAgLy9cbiAgdXJsLmhyZWYgPSB1cmwudG9TdHJpbmcoKTtcbn1cblxuLyoqXG4gKiBUaGlzIGlzIGNvbnZlbmllbmNlIG1ldGhvZCBmb3IgY2hhbmdpbmcgcHJvcGVydGllcyBpbiB0aGUgVVJMIGluc3RhbmNlIHRvXG4gKiBpbnN1cmUgdGhhdCB0aGV5IGFsbCBwcm9wYWdhdGUgY29ycmVjdGx5LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXJ0ICAgICAgICAgIFByb3BlcnR5IHdlIG5lZWQgdG8gYWRqdXN0LlxuICogQHBhcmFtIHtNaXhlZH0gdmFsdWUgICAgICAgICAgVGhlIG5ld2x5IGFzc2lnbmVkIHZhbHVlLlxuICogQHBhcmFtIHtCb29sZWFufEZ1bmN0aW9ufSBmbiAgV2hlbiBzZXR0aW5nIHRoZSBxdWVyeSwgaXQgd2lsbCBiZSB0aGUgZnVuY3Rpb25cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZWQgdG8gcGFyc2UgdGhlIHF1ZXJ5LlxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgV2hlbiBzZXR0aW5nIHRoZSBwcm90b2NvbCwgZG91YmxlIHNsYXNoIHdpbGwgYmVcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQgZnJvbSB0aGUgZmluYWwgdXJsIGlmIGl0IGlzIHRydWUuXG4gKiBAcmV0dXJucyB7VVJMfSBVUkwgaW5zdGFuY2UgZm9yIGNoYWluaW5nLlxuICogQHB1YmxpY1xuICovXG5mdW5jdGlvbiBzZXQocGFydCwgdmFsdWUsIGZuKSB7XG4gIHZhciB1cmwgPSB0aGlzO1xuXG4gIHN3aXRjaCAocGFydCkge1xuICAgIGNhc2UgJ3F1ZXJ5JzpcbiAgICAgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIHZhbHVlICYmIHZhbHVlLmxlbmd0aCkge1xuICAgICAgICB2YWx1ZSA9IChmbiB8fCBxcy5wYXJzZSkodmFsdWUpO1xuICAgICAgfVxuXG4gICAgICB1cmxbcGFydF0gPSB2YWx1ZTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAncG9ydCc6XG4gICAgICB1cmxbcGFydF0gPSB2YWx1ZTtcblxuICAgICAgaWYgKCFyZXF1aXJlZCh2YWx1ZSwgdXJsLnByb3RvY29sKSkge1xuICAgICAgICB1cmwuaG9zdCA9IHVybC5ob3N0bmFtZTtcbiAgICAgICAgdXJsW3BhcnRdID0gJyc7XG4gICAgICB9IGVsc2UgaWYgKHZhbHVlKSB7XG4gICAgICAgIHVybC5ob3N0ID0gdXJsLmhvc3RuYW1lICsnOicrIHZhbHVlO1xuICAgICAgfVxuXG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2hvc3RuYW1lJzpcbiAgICAgIHVybFtwYXJ0XSA9IHZhbHVlO1xuXG4gICAgICBpZiAodXJsLnBvcnQpIHZhbHVlICs9ICc6JysgdXJsLnBvcnQ7XG4gICAgICB1cmwuaG9zdCA9IHZhbHVlO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdob3N0JzpcbiAgICAgIHVybFtwYXJ0XSA9IHZhbHVlO1xuXG4gICAgICBpZiAoLzpcXGQrJC8udGVzdCh2YWx1ZSkpIHtcbiAgICAgICAgdmFsdWUgPSB2YWx1ZS5zcGxpdCgnOicpO1xuICAgICAgICB1cmwucG9ydCA9IHZhbHVlLnBvcCgpO1xuICAgICAgICB1cmwuaG9zdG5hbWUgPSB2YWx1ZS5qb2luKCc6Jyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB1cmwuaG9zdG5hbWUgPSB2YWx1ZTtcbiAgICAgICAgdXJsLnBvcnQgPSAnJztcbiAgICAgIH1cblxuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdwcm90b2NvbCc6XG4gICAgICB1cmwucHJvdG9jb2wgPSB2YWx1ZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgdXJsLnNsYXNoZXMgPSAhZm47XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ3BhdGhuYW1lJzpcbiAgICBjYXNlICdoYXNoJzpcbiAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICB2YXIgY2hhciA9IHBhcnQgPT09ICdwYXRobmFtZScgPyAnLycgOiAnIyc7XG4gICAgICAgIHVybFtwYXJ0XSA9IHZhbHVlLmNoYXJBdCgwKSAhPT0gY2hhciA/IGNoYXIgKyB2YWx1ZSA6IHZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdXJsW3BhcnRdID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBicmVhaztcblxuICAgIGRlZmF1bHQ6XG4gICAgICB1cmxbcGFydF0gPSB2YWx1ZTtcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcnVsZXMubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaW5zID0gcnVsZXNbaV07XG5cbiAgICBpZiAoaW5zWzRdKSB1cmxbaW5zWzFdXSA9IHVybFtpbnNbMV1dLnRvTG93ZXJDYXNlKCk7XG4gIH1cblxuICB1cmwub3JpZ2luID0gdXJsLnByb3RvY29sICYmIHVybC5ob3N0ICYmIHVybC5wcm90b2NvbCAhPT0gJ2ZpbGU6J1xuICAgID8gdXJsLnByb3RvY29sICsnLy8nKyB1cmwuaG9zdFxuICAgIDogJ251bGwnO1xuXG4gIHVybC5ocmVmID0gdXJsLnRvU3RyaW5nKCk7XG5cbiAgcmV0dXJuIHVybDtcbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gdGhlIHByb3BlcnRpZXMgYmFjayBpbiB0byBhIHZhbGlkIGFuZCBmdWxsIFVSTCBzdHJpbmcuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gc3RyaW5naWZ5IE9wdGlvbmFsIHF1ZXJ5IHN0cmluZ2lmeSBmdW5jdGlvbi5cbiAqIEByZXR1cm5zIHtTdHJpbmd9IENvbXBpbGVkIHZlcnNpb24gb2YgdGhlIFVSTC5cbiAqIEBwdWJsaWNcbiAqL1xuZnVuY3Rpb24gdG9TdHJpbmcoc3RyaW5naWZ5KSB7XG4gIGlmICghc3RyaW5naWZ5IHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBzdHJpbmdpZnkpIHN0cmluZ2lmeSA9IHFzLnN0cmluZ2lmeTtcblxuICB2YXIgcXVlcnlcbiAgICAsIHVybCA9IHRoaXNcbiAgICAsIHByb3RvY29sID0gdXJsLnByb3RvY29sO1xuXG4gIGlmIChwcm90b2NvbCAmJiBwcm90b2NvbC5jaGFyQXQocHJvdG9jb2wubGVuZ3RoIC0gMSkgIT09ICc6JykgcHJvdG9jb2wgKz0gJzonO1xuXG4gIHZhciByZXN1bHQgPSBwcm90b2NvbCArICh1cmwuc2xhc2hlcyA/ICcvLycgOiAnJyk7XG5cbiAgaWYgKHVybC51c2VybmFtZSkge1xuICAgIHJlc3VsdCArPSB1cmwudXNlcm5hbWU7XG4gICAgaWYgKHVybC5wYXNzd29yZCkgcmVzdWx0ICs9ICc6JysgdXJsLnBhc3N3b3JkO1xuICAgIHJlc3VsdCArPSAnQCc7XG4gIH1cblxuICByZXN1bHQgKz0gdXJsLmhvc3QgKyB1cmwucGF0aG5hbWU7XG5cbiAgcXVlcnkgPSAnb2JqZWN0JyA9PT0gdHlwZW9mIHVybC5xdWVyeSA/IHN0cmluZ2lmeSh1cmwucXVlcnkpIDogdXJsLnF1ZXJ5O1xuICBpZiAocXVlcnkpIHJlc3VsdCArPSAnPycgIT09IHF1ZXJ5LmNoYXJBdCgwKSA/ICc/JysgcXVlcnkgOiBxdWVyeTtcblxuICBpZiAodXJsLmhhc2gpIHJlc3VsdCArPSB1cmwuaGFzaDtcblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5VcmwucHJvdG90eXBlID0geyBzZXQ6IHNldCwgdG9TdHJpbmc6IHRvU3RyaW5nIH07XG5cbi8vXG4vLyBFeHBvc2UgdGhlIFVSTCBwYXJzZXIgYW5kIHNvbWUgYWRkaXRpb25hbCBwcm9wZXJ0aWVzIHRoYXQgbWlnaHQgYmUgdXNlZnVsIGZvclxuLy8gb3RoZXJzIG9yIHRlc3RpbmcuXG4vL1xuVXJsLmV4dHJhY3RQcm90b2NvbCA9IGV4dHJhY3RQcm90b2NvbDtcblVybC5sb2NhdGlvbiA9IGxvbGNhdGlvbjtcblVybC5xcyA9IHFzO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVybDtcbiIsIi8qXG4gKiBUaGlzIGRlbGF5IGFsbG93cyB0aGUgdGhyZWFkIHRvIGZpbmlzaCBhc3NpZ25pbmcgaXRzIG9uKiBtZXRob2RzXG4gKiBiZWZvcmUgaW52b2tpbmcgdGhlIGRlbGF5IGNhbGxiYWNrLiBUaGlzIGlzIHB1cmVseSBhIHRpbWluZyBoYWNrLlxuICogaHR0cDovL2dlZWthYnl0ZS5ibG9nc3BvdC5jb20vMjAxNC8wMS9qYXZhc2NyaXB0LWVmZmVjdC1vZi1zZXR0aW5nLXNldHRpbWVvdXQuaHRtbFxuICpcbiAqIEBwYXJhbSB7Y2FsbGJhY2s6IGZ1bmN0aW9ufSB0aGUgY2FsbGJhY2sgd2hpY2ggd2lsbCBiZSBpbnZva2VkIGFmdGVyIHRoZSB0aW1lb3V0XG4gKiBAcGFybWEge2NvbnRleHQ6IG9iamVjdH0gdGhlIGNvbnRleHQgaW4gd2hpY2ggdG8gaW52b2tlIHRoZSBmdW5jdGlvblxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBkZWxheShjYWxsYmFjaywgY29udGV4dCkge1xuICBzZXRUaW1lb3V0KHRpbWVvdXRDb250ZXh0ID0+IGNhbGxiYWNrLmNhbGwodGltZW91dENvbnRleHQpLCA0LCBjb250ZXh0KTtcbn1cbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGxvZyhtZXRob2QsIG1lc3NhZ2UpIHtcbiAgLyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xuICBpZiAodHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAndGVzdCcpIHtcbiAgICBjb25zb2xlW21ldGhvZF0uY2FsbChudWxsLCBtZXNzYWdlKTtcbiAgfVxuICAvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbnNvbGUgKi9cbn1cbiIsImV4cG9ydCBmdW5jdGlvbiByZWplY3QoYXJyYXksIGNhbGxiYWNrKSB7XG4gIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgYXJyYXkuZm9yRWFjaChpdGVtSW5BcnJheSA9PiB7XG4gICAgaWYgKCFjYWxsYmFjayhpdGVtSW5BcnJheSkpIHtcbiAgICAgIHJlc3VsdHMucHVzaChpdGVtSW5BcnJheSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcmVzdWx0cztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbHRlcihhcnJheSwgY2FsbGJhY2spIHtcbiAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICBhcnJheS5mb3JFYWNoKGl0ZW1JbkFycmF5ID0+IHtcbiAgICBpZiAoY2FsbGJhY2soaXRlbUluQXJyYXkpKSB7XG4gICAgICByZXN1bHRzLnB1c2goaXRlbUluQXJyYXkpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG4iLCJpbXBvcnQgeyByZWplY3QsIGZpbHRlciB9IGZyb20gJy4uL2hlbHBlcnMvYXJyYXktaGVscGVycyc7XG5cbi8qXG4gKiBFdmVudFRhcmdldCBpcyBhbiBpbnRlcmZhY2UgaW1wbGVtZW50ZWQgYnkgb2JqZWN0cyB0aGF0IGNhblxuICogcmVjZWl2ZSBldmVudHMgYW5kIG1heSBoYXZlIGxpc3RlbmVycyBmb3IgdGhlbS5cbiAqXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvRXZlbnRUYXJnZXRcbiAqL1xuY2xhc3MgRXZlbnRUYXJnZXQge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmxpc3RlbmVycyA9IHt9O1xuICB9XG5cbiAgLypcbiAgICogVGllcyBhIGxpc3RlbmVyIGZ1bmN0aW9uIHRvIGFuIGV2ZW50IHR5cGUgd2hpY2ggY2FuIGxhdGVyIGJlIGludm9rZWQgdmlhIHRoZVxuICAgKiBkaXNwYXRjaEV2ZW50IG1ldGhvZC5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSB0aGUgdHlwZSBvZiBldmVudCAoaWU6ICdvcGVuJywgJ21lc3NhZ2UnLCBldGMuKVxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaXN0ZW5lciAtIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGludm9rZSB3aGVuIGFuIGV2ZW50IGlzIGRpc3BhdGNoZWQgbWF0Y2hpbmcgdGhlIHR5cGVcbiAgICogQHBhcmFtIHtib29sZWFufSB1c2VDYXB0dXJlIC0gTi9BIFRPRE86IGltcGxlbWVudCB1c2VDYXB0dXJlIGZ1bmN0aW9uYWxpdHlcbiAgICovXG4gIGFkZEV2ZW50TGlzdGVuZXIodHlwZSwgbGlzdGVuZXIgLyogLCB1c2VDYXB0dXJlICovKSB7XG4gICAgaWYgKHR5cGVvZiBsaXN0ZW5lciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHRoaXMubGlzdGVuZXJzW3R5cGVdKSkge1xuICAgICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IFtdO1xuICAgICAgfVxuXG4gICAgICAvLyBPbmx5IGFkZCB0aGUgc2FtZSBmdW5jdGlvbiBvbmNlXG4gICAgICBpZiAoZmlsdGVyKHRoaXMubGlzdGVuZXJzW3R5cGVdLCBpdGVtID0+IGl0ZW0gPT09IGxpc3RlbmVyKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhpcy5saXN0ZW5lcnNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICogUmVtb3ZlcyB0aGUgbGlzdGVuZXIgc28gaXQgd2lsbCBubyBsb25nZXIgYmUgaW52b2tlZCB2aWEgdGhlIGRpc3BhdGNoRXZlbnQgbWV0aG9kLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIHRoZSB0eXBlIG9mIGV2ZW50IChpZTogJ29wZW4nLCAnbWVzc2FnZScsIGV0Yy4pXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpc3RlbmVyIC0gY2FsbGJhY2sgZnVuY3Rpb24gdG8gaW52b2tlIHdoZW4gYW4gZXZlbnQgaXMgZGlzcGF0Y2hlZCBtYXRjaGluZyB0aGUgdHlwZVxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IHVzZUNhcHR1cmUgLSBOL0EgVE9ETzogaW1wbGVtZW50IHVzZUNhcHR1cmUgZnVuY3Rpb25hbGl0eVxuICAgKi9cbiAgcmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCByZW1vdmluZ0xpc3RlbmVyIC8qICwgdXNlQ2FwdHVyZSAqLykge1xuICAgIGNvbnN0IGFycmF5T2ZMaXN0ZW5lcnMgPSB0aGlzLmxpc3RlbmVyc1t0eXBlXTtcbiAgICB0aGlzLmxpc3RlbmVyc1t0eXBlXSA9IHJlamVjdChhcnJheU9mTGlzdGVuZXJzLCBsaXN0ZW5lciA9PiBsaXN0ZW5lciA9PT0gcmVtb3ZpbmdMaXN0ZW5lcik7XG4gIH1cblxuICAvKlxuICAgKiBJbnZva2VzIGFsbCBsaXN0ZW5lciBmdW5jdGlvbnMgdGhhdCBhcmUgbGlzdGVuaW5nIHRvIHRoZSBnaXZlbiBldmVudC50eXBlIHByb3BlcnR5LiBFYWNoXG4gICAqIGxpc3RlbmVyIHdpbGwgYmUgcGFzc2VkIHRoZSBldmVudCBhcyB0aGUgZmlyc3QgYXJndW1lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBldmVudCAtIGV2ZW50IG9iamVjdCB3aGljaCB3aWxsIGJlIHBhc3NlZCB0byBhbGwgbGlzdGVuZXJzIG9mIHRoZSBldmVudC50eXBlIHByb3BlcnR5XG4gICAqL1xuICBkaXNwYXRjaEV2ZW50KGV2ZW50LCAuLi5jdXN0b21Bcmd1bWVudHMpIHtcbiAgICBjb25zdCBldmVudE5hbWUgPSBldmVudC50eXBlO1xuICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzW2V2ZW50TmFtZV07XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkobGlzdGVuZXJzKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGxpc3RlbmVycy5mb3JFYWNoKGxpc3RlbmVyID0+IHtcbiAgICAgIGlmIChjdXN0b21Bcmd1bWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBjdXN0b21Bcmd1bWVudHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGlzdGVuZXIuY2FsbCh0aGlzLCBldmVudCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFdmVudFRhcmdldDtcbiIsImltcG9ydCB7IHJlamVjdCB9IGZyb20gJy4vaGVscGVycy9hcnJheS1oZWxwZXJzJztcblxuZnVuY3Rpb24gdHJpbVF1ZXJ5UGFydEZyb21VUkwodXJsKSB7XG4gIGNvbnN0IHF1ZXJ5SW5kZXggPSB1cmwuaW5kZXhPZignPycpO1xuICByZXR1cm4gcXVlcnlJbmRleCA+PSAwID8gdXJsLnNsaWNlKDAsIHF1ZXJ5SW5kZXgpIDogdXJsO1xufVxuXG4vKlxuICogVGhlIG5ldHdvcmsgYnJpZGdlIGlzIGEgd2F5IGZvciB0aGUgbW9jayB3ZWJzb2NrZXQgb2JqZWN0IHRvICdjb21tdW5pY2F0ZScgd2l0aFxuICogYWxsIGF2YWlsYWJsZSBzZXJ2ZXJzLiBUaGlzIGlzIGEgc2luZ2xldG9uIG9iamVjdCBzbyBpdCBpcyBpbXBvcnRhbnQgdGhhdCB5b3VcbiAqIGNsZWFuIHVwIHVybE1hcCB3aGVuZXZlciB5b3UgYXJlIGZpbmlzaGVkLlxuICovXG5jbGFzcyBOZXR3b3JrQnJpZGdlIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy51cmxNYXAgPSB7fTtcbiAgfVxuXG4gIC8qXG4gICAqIEF0dGFjaGVzIGEgd2Vic29ja2V0IG9iamVjdCB0byB0aGUgdXJsTWFwIGhhc2ggc28gdGhhdCBpdCBjYW4gZmluZCB0aGUgc2VydmVyXG4gICAqIGl0IGlzIGNvbm5lY3RlZCB0byBhbmQgdGhlIHNlcnZlciBpbiB0dXJuIGNhbiBmaW5kIGl0LlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gd2Vic29ja2V0IC0gd2Vic29ja2V0IG9iamVjdCB0byBhZGQgdG8gdGhlIHVybE1hcCBoYXNoXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB1cmxcbiAgICovXG4gIGF0dGFjaFdlYlNvY2tldCh3ZWJzb2NrZXQsIHVybCkge1xuICAgIGNvbnN0IHNlcnZlclVSTCA9IHRyaW1RdWVyeVBhcnRGcm9tVVJMKHVybCk7XG4gICAgY29uc3QgY29ubmVjdGlvbkxvb2t1cCA9IHRoaXMudXJsTWFwW3NlcnZlclVSTF07XG5cbiAgICBpZiAoY29ubmVjdGlvbkxvb2t1cCAmJiBjb25uZWN0aW9uTG9va3VwLnNlcnZlciAmJiBjb25uZWN0aW9uTG9va3VwLndlYnNvY2tldHMuaW5kZXhPZih3ZWJzb2NrZXQpID09PSAtMSkge1xuICAgICAgY29ubmVjdGlvbkxvb2t1cC53ZWJzb2NrZXRzLnB1c2god2Vic29ja2V0KTtcbiAgICAgIHJldHVybiBjb25uZWN0aW9uTG9va3VwLnNlcnZlcjtcbiAgICB9XG4gIH1cblxuICAvKlxuICAgKiBBdHRhY2hlcyBhIHdlYnNvY2tldCB0byBhIHJvb21cbiAgICovXG4gIGFkZE1lbWJlcnNoaXBUb1Jvb20od2Vic29ja2V0LCByb29tKSB7XG4gICAgY29uc3QgY29ubmVjdGlvbkxvb2t1cCA9IHRoaXMudXJsTWFwW3RyaW1RdWVyeVBhcnRGcm9tVVJMKHdlYnNvY2tldC51cmwpXTtcblxuICAgIGlmIChjb25uZWN0aW9uTG9va3VwICYmIGNvbm5lY3Rpb25Mb29rdXAuc2VydmVyICYmIGNvbm5lY3Rpb25Mb29rdXAud2Vic29ja2V0cy5pbmRleE9mKHdlYnNvY2tldCkgIT09IC0xKSB7XG4gICAgICBpZiAoIWNvbm5lY3Rpb25Mb29rdXAucm9vbU1lbWJlcnNoaXBzW3Jvb21dKSB7XG4gICAgICAgIGNvbm5lY3Rpb25Mb29rdXAucm9vbU1lbWJlcnNoaXBzW3Jvb21dID0gW107XG4gICAgICB9XG5cbiAgICAgIGNvbm5lY3Rpb25Mb29rdXAucm9vbU1lbWJlcnNoaXBzW3Jvb21dLnB1c2god2Vic29ja2V0KTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAgKiBBdHRhY2hlcyBhIHNlcnZlciBvYmplY3QgdG8gdGhlIHVybE1hcCBoYXNoIHNvIHRoYXQgaXQgY2FuIGZpbmQgYSB3ZWJzb2NrZXRzXG4gICAqIHdoaWNoIGFyZSBjb25uZWN0ZWQgdG8gaXQgYW5kIHNvIHRoYXQgd2Vic29ja2V0cyBjYW4gaW4gdHVybiBjYW4gZmluZCBpdC5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IHNlcnZlciAtIHNlcnZlciBvYmplY3QgdG8gYWRkIHRvIHRoZSB1cmxNYXAgaGFzaFxuICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsXG4gICAqL1xuICBhdHRhY2hTZXJ2ZXIoc2VydmVyLCB1cmwpIHtcbiAgICBjb25zdCBjb25uZWN0aW9uTG9va3VwID0gdGhpcy51cmxNYXBbdXJsXTtcblxuICAgIGlmICghY29ubmVjdGlvbkxvb2t1cCkge1xuICAgICAgdGhpcy51cmxNYXBbdXJsXSA9IHtcbiAgICAgICAgc2VydmVyLFxuICAgICAgICB3ZWJzb2NrZXRzOiBbXSxcbiAgICAgICAgcm9vbU1lbWJlcnNoaXBzOiB7fVxuICAgICAgfTtcblxuICAgICAgcmV0dXJuIHNlcnZlcjtcbiAgICB9XG4gIH1cblxuICAvKlxuICAgKiBGaW5kcyB0aGUgc2VydmVyIHdoaWNoIGlzICdydW5uaW5nJyBvbiB0aGUgZ2l2ZW4gdXJsLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gdGhlIHVybCB0byB1c2UgdG8gZmluZCB3aGljaCBzZXJ2ZXIgaXMgcnVubmluZyBvbiBpdFxuICAgKi9cbiAgc2VydmVyTG9va3VwKHVybCkge1xuICAgIGNvbnN0IHNlcnZlclVSTCA9IHRyaW1RdWVyeVBhcnRGcm9tVVJMKHVybCk7XG4gICAgY29uc3QgY29ubmVjdGlvbkxvb2t1cCA9IHRoaXMudXJsTWFwW3NlcnZlclVSTF07XG5cbiAgICBpZiAoY29ubmVjdGlvbkxvb2t1cCkge1xuICAgICAgcmV0dXJuIGNvbm5lY3Rpb25Mb29rdXAuc2VydmVyO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAqIEZpbmRzIGFsbCB3ZWJzb2NrZXRzIHdoaWNoIGlzICdsaXN0ZW5pbmcnIG9uIHRoZSBnaXZlbiB1cmwuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSB0aGUgdXJsIHRvIHVzZSB0byBmaW5kIGFsbCB3ZWJzb2NrZXRzIHdoaWNoIGFyZSBhc3NvY2lhdGVkIHdpdGggaXRcbiAgICogQHBhcmFtIHtzdHJpbmd9IHJvb20gLSBpZiBhIHJvb20gaXMgcHJvdmlkZWQsIHdpbGwgb25seSByZXR1cm4gc29ja2V0cyBpbiB0aGlzIHJvb21cbiAgICogQHBhcmFtIHtjbGFzc30gYnJvYWRjYXN0ZXIgLSBzb2NrZXQgdGhhdCBpcyBicm9hZGNhc3RpbmcgYW5kIGlzIHRvIGJlIGV4Y2x1ZGVkIGZyb20gdGhlIGxvb2t1cFxuICAgKi9cbiAgd2Vic29ja2V0c0xvb2t1cCh1cmwsIHJvb20sIGJyb2FkY2FzdGVyKSB7XG4gICAgY29uc3Qgc2VydmVyVVJMID0gdHJpbVF1ZXJ5UGFydEZyb21VUkwodXJsKTtcbiAgICBsZXQgd2Vic29ja2V0cztcbiAgICBjb25zdCBjb25uZWN0aW9uTG9va3VwID0gdGhpcy51cmxNYXBbc2VydmVyVVJMXTtcblxuICAgIHdlYnNvY2tldHMgPSBjb25uZWN0aW9uTG9va3VwID8gY29ubmVjdGlvbkxvb2t1cC53ZWJzb2NrZXRzIDogW107XG5cbiAgICBpZiAocm9vbSkge1xuICAgICAgY29uc3QgbWVtYmVycyA9IGNvbm5lY3Rpb25Mb29rdXAucm9vbU1lbWJlcnNoaXBzW3Jvb21dO1xuICAgICAgd2Vic29ja2V0cyA9IG1lbWJlcnMgfHwgW107XG4gICAgfVxuXG4gICAgcmV0dXJuIGJyb2FkY2FzdGVyID8gd2Vic29ja2V0cy5maWx0ZXIod2Vic29ja2V0ID0+IHdlYnNvY2tldCAhPT0gYnJvYWRjYXN0ZXIpIDogd2Vic29ja2V0cztcbiAgfVxuXG4gIC8qXG4gICAqIFJlbW92ZXMgdGhlIGVudHJ5IGFzc29jaWF0ZWQgd2l0aCB0aGUgdXJsLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsXG4gICAqL1xuICByZW1vdmVTZXJ2ZXIodXJsKSB7XG4gICAgZGVsZXRlIHRoaXMudXJsTWFwW3RyaW1RdWVyeVBhcnRGcm9tVVJMKHVybCldO1xuICB9XG5cbiAgLypcbiAgICogUmVtb3ZlcyB0aGUgaW5kaXZpZHVhbCB3ZWJzb2NrZXQgZnJvbSB0aGUgbWFwIG9mIGFzc29jaWF0ZWQgd2Vic29ja2V0cy5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IHdlYnNvY2tldCAtIHdlYnNvY2tldCBvYmplY3QgdG8gcmVtb3ZlIGZyb20gdGhlIHVybCBtYXBcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVybFxuICAgKi9cbiAgcmVtb3ZlV2ViU29ja2V0KHdlYnNvY2tldCwgdXJsKSB7XG4gICAgY29uc3Qgc2VydmVyVVJMID0gdHJpbVF1ZXJ5UGFydEZyb21VUkwodXJsKTtcbiAgICBjb25zdCBjb25uZWN0aW9uTG9va3VwID0gdGhpcy51cmxNYXBbc2VydmVyVVJMXTtcblxuICAgIGlmIChjb25uZWN0aW9uTG9va3VwKSB7XG4gICAgICBjb25uZWN0aW9uTG9va3VwLndlYnNvY2tldHMgPSByZWplY3QoY29ubmVjdGlvbkxvb2t1cC53ZWJzb2NrZXRzLCBzb2NrZXQgPT4gc29ja2V0ID09PSB3ZWJzb2NrZXQpO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAqIFJlbW92ZXMgYSB3ZWJzb2NrZXQgZnJvbSBhIHJvb21cbiAgICovXG4gIHJlbW92ZU1lbWJlcnNoaXBGcm9tUm9vbSh3ZWJzb2NrZXQsIHJvb20pIHtcbiAgICBjb25zdCBjb25uZWN0aW9uTG9va3VwID0gdGhpcy51cmxNYXBbdHJpbVF1ZXJ5UGFydEZyb21VUkwod2Vic29ja2V0LnVybCldO1xuICAgIGNvbnN0IG1lbWJlcnNoaXBzID0gY29ubmVjdGlvbkxvb2t1cC5yb29tTWVtYmVyc2hpcHNbcm9vbV07XG5cbiAgICBpZiAoY29ubmVjdGlvbkxvb2t1cCAmJiBtZW1iZXJzaGlwcyAhPT0gbnVsbCkge1xuICAgICAgY29ubmVjdGlvbkxvb2t1cC5yb29tTWVtYmVyc2hpcHNbcm9vbV0gPSByZWplY3QobWVtYmVyc2hpcHMsIHNvY2tldCA9PiBzb2NrZXQgPT09IHdlYnNvY2tldCk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IG5ldyBOZXR3b3JrQnJpZGdlKCk7IC8vIE5vdGU6IHRoaXMgaXMgYSBzaW5nbGV0b25cbiIsIi8qXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvQ2xvc2VFdmVudFxuICovXG5leHBvcnQgY29uc3QgQ0xPU0VfQ09ERVMgPSB7XG4gIENMT1NFX05PUk1BTDogMTAwMCxcbiAgQ0xPU0VfR09JTkdfQVdBWTogMTAwMSxcbiAgQ0xPU0VfUFJPVE9DT0xfRVJST1I6IDEwMDIsXG4gIENMT1NFX1VOU1VQUE9SVEVEOiAxMDAzLFxuICBDTE9TRV9OT19TVEFUVVM6IDEwMDUsXG4gIENMT1NFX0FCTk9STUFMOiAxMDA2LFxuICBVTlNVUFBPUlRFRF9EQVRBOiAxMDA3LFxuICBQT0xJQ1lfVklPTEFUSU9OOiAxMDA4LFxuICBDTE9TRV9UT09fTEFSR0U6IDEwMDksXG4gIE1JU1NJTkdfRVhURU5TSU9OOiAxMDEwLFxuICBJTlRFUk5BTF9FUlJPUjogMTAxMSxcbiAgU0VSVklDRV9SRVNUQVJUOiAxMDEyLFxuICBUUllfQUdBSU5fTEFURVI6IDEwMTMsXG4gIFRMU19IQU5EU0hBS0U6IDEwMTVcbn07XG5cbmV4cG9ydCBjb25zdCBFUlJPUl9QUkVGSVggPSB7XG4gIENPTlNUUlVDVE9SX0VSUk9SOiBcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ1dlYlNvY2tldCc6XCIsXG4gIENMT1NFX0VSUk9SOiBcIkZhaWxlZCB0byBleGVjdXRlICdjbG9zZScgb24gJ1dlYlNvY2tldCc6XCIsXG4gIEVWRU5UOiB7XG4gICAgQ09OU1RSVUNUOiBcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ0V2ZW50JzpcIixcbiAgICBNRVNTQUdFOiBcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ01lc3NhZ2VFdmVudCc6XCIsXG4gICAgQ0xPU0U6IFwiRmFpbGVkIHRvIGNvbnN0cnVjdCAnQ2xvc2VFdmVudCc6XCJcbiAgfVxufTtcbiIsImV4cG9ydCBkZWZhdWx0IGNsYXNzIEV2ZW50UHJvdG90eXBlIHtcbiAgLy8gTm9vcHNcbiAgc3RvcFByb3BhZ2F0aW9uKCkge31cbiAgc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCkge31cblxuICAvLyBpZiBubyBhcmd1bWVudHMgYXJlIHBhc3NlZCB0aGVuIHRoZSB0eXBlIGlzIHNldCB0byBcInVuZGVmaW5lZFwiIG9uXG4gIC8vIGNocm9tZSBhbmQgc2FmYXJpLlxuICBpbml0RXZlbnQodHlwZSA9ICd1bmRlZmluZWQnLCBidWJibGVzID0gZmFsc2UsIGNhbmNlbGFibGUgPSBmYWxzZSkge1xuICAgIHRoaXMudHlwZSA9IGAke3R5cGV9YDtcbiAgICB0aGlzLmJ1YmJsZXMgPSBCb29sZWFuKGJ1YmJsZXMpO1xuICAgIHRoaXMuY2FuY2VsYWJsZSA9IEJvb2xlYW4oY2FuY2VsYWJsZSk7XG4gIH1cbn1cbiIsImltcG9ydCBFdmVudFByb3RvdHlwZSBmcm9tICcuL3Byb3RvdHlwZSc7XG5pbXBvcnQgeyBFUlJPUl9QUkVGSVggfSBmcm9tICcuLi9jb25zdGFudHMnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFdmVudCBleHRlbmRzIEV2ZW50UHJvdG90eXBlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgZXZlbnRJbml0Q29uZmlnID0ge30pIHtcbiAgICBzdXBlcigpO1xuXG4gICAgaWYgKCF0eXBlKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGAke0VSUk9SX1BSRUZJWC5FVkVOVF9FUlJPUn0gMSBhcmd1bWVudCByZXF1aXJlZCwgYnV0IG9ubHkgMCBwcmVzZW50LmApO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgZXZlbnRJbml0Q29uZmlnICE9PSAnb2JqZWN0Jykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgJHtFUlJPUl9QUkVGSVguRVZFTlRfRVJST1J9IHBhcmFtZXRlciAyICgnZXZlbnRJbml0RGljdCcpIGlzIG5vdCBhbiBvYmplY3QuYCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBidWJibGVzLCBjYW5jZWxhYmxlIH0gPSBldmVudEluaXRDb25maWc7XG5cbiAgICB0aGlzLnR5cGUgPSBgJHt0eXBlfWA7XG4gICAgdGhpcy50aW1lU3RhbXAgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMudGFyZ2V0ID0gbnVsbDtcbiAgICB0aGlzLnNyY0VsZW1lbnQgPSBudWxsO1xuICAgIHRoaXMucmV0dXJuVmFsdWUgPSB0cnVlO1xuICAgIHRoaXMuaXNUcnVzdGVkID0gZmFsc2U7XG4gICAgdGhpcy5ldmVudFBoYXNlID0gMDtcbiAgICB0aGlzLmRlZmF1bHRQcmV2ZW50ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmN1cnJlbnRUYXJnZXQgPSBudWxsO1xuICAgIHRoaXMuY2FuY2VsYWJsZSA9IGNhbmNlbGFibGUgPyBCb29sZWFuKGNhbmNlbGFibGUpIDogZmFsc2U7XG4gICAgdGhpcy5jYW5uY2VsQnViYmxlID0gZmFsc2U7XG4gICAgdGhpcy5idWJibGVzID0gYnViYmxlcyA/IEJvb2xlYW4oYnViYmxlcykgOiBmYWxzZTtcbiAgfVxufVxuIiwiaW1wb3J0IEV2ZW50UHJvdG90eXBlIGZyb20gJy4vcHJvdG90eXBlJztcbmltcG9ydCB7IEVSUk9SX1BSRUZJWCB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1lc3NhZ2VFdmVudCBleHRlbmRzIEV2ZW50UHJvdG90eXBlIHtcbiAgY29uc3RydWN0b3IodHlwZSwgZXZlbnRJbml0Q29uZmlnID0ge30pIHtcbiAgICBzdXBlcigpO1xuXG4gICAgaWYgKCF0eXBlKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGAke0VSUk9SX1BSRUZJWC5FVkVOVC5NRVNTQUdFfSAxIGFyZ3VtZW50IHJlcXVpcmVkLCBidXQgb25seSAwIHByZXNlbnQuYCk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBldmVudEluaXRDb25maWcgIT09ICdvYmplY3QnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGAke0VSUk9SX1BSRUZJWC5FVkVOVC5NRVNTQUdFfSBwYXJhbWV0ZXIgMiAoJ2V2ZW50SW5pdERpY3QnKSBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBidWJibGVzLCBjYW5jZWxhYmxlLCBkYXRhLCBvcmlnaW4sIGxhc3RFdmVudElkLCBwb3J0cyB9ID0gZXZlbnRJbml0Q29uZmlnO1xuXG4gICAgdGhpcy50eXBlID0gYCR7dHlwZX1gO1xuICAgIHRoaXMudGltZVN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICB0aGlzLnRhcmdldCA9IG51bGw7XG4gICAgdGhpcy5zcmNFbGVtZW50ID0gbnVsbDtcbiAgICB0aGlzLnJldHVyblZhbHVlID0gdHJ1ZTtcbiAgICB0aGlzLmlzVHJ1c3RlZCA9IGZhbHNlO1xuICAgIHRoaXMuZXZlbnRQaGFzZSA9IDA7XG4gICAgdGhpcy5kZWZhdWx0UHJldmVudGVkID0gZmFsc2U7XG4gICAgdGhpcy5jdXJyZW50VGFyZ2V0ID0gbnVsbDtcbiAgICB0aGlzLmNhbmNlbGFibGUgPSBjYW5jZWxhYmxlID8gQm9vbGVhbihjYW5jZWxhYmxlKSA6IGZhbHNlO1xuICAgIHRoaXMuY2FubmNlbEJ1YmJsZSA9IGZhbHNlO1xuICAgIHRoaXMuYnViYmxlcyA9IGJ1YmJsZXMgPyBCb29sZWFuKGJ1YmJsZXMpIDogZmFsc2U7XG4gICAgdGhpcy5vcmlnaW4gPSBgJHtvcmlnaW59YDtcbiAgICB0aGlzLnBvcnRzID0gdHlwZW9mIHBvcnRzID09PSAndW5kZWZpbmVkJyA/IG51bGwgOiBwb3J0cztcbiAgICB0aGlzLmRhdGEgPSB0eXBlb2YgZGF0YSA9PT0gJ3VuZGVmaW5lZCcgPyBudWxsIDogZGF0YTtcbiAgICB0aGlzLmxhc3RFdmVudElkID0gYCR7bGFzdEV2ZW50SWQgfHwgJyd9YDtcbiAgfVxufVxuIiwiaW1wb3J0IEV2ZW50UHJvdG90eXBlIGZyb20gJy4vcHJvdG90eXBlJztcbmltcG9ydCB7IEVSUk9SX1BSRUZJWCB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENsb3NlRXZlbnQgZXh0ZW5kcyBFdmVudFByb3RvdHlwZSB7XG4gIGNvbnN0cnVjdG9yKHR5cGUsIGV2ZW50SW5pdENvbmZpZyA9IHt9KSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmICghdHlwZSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgJHtFUlJPUl9QUkVGSVguRVZFTlQuQ0xPU0V9IDEgYXJndW1lbnQgcmVxdWlyZWQsIGJ1dCBvbmx5IDAgcHJlc2VudC5gKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGV2ZW50SW5pdENvbmZpZyAhPT0gJ29iamVjdCcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYCR7RVJST1JfUFJFRklYLkVWRU5ULkNMT1NFfSBwYXJhbWV0ZXIgMiAoJ2V2ZW50SW5pdERpY3QnKSBpcyBub3QgYW4gb2JqZWN0YCk7XG4gICAgfVxuXG4gICAgY29uc3QgeyBidWJibGVzLCBjYW5jZWxhYmxlLCBjb2RlLCByZWFzb24sIHdhc0NsZWFuIH0gPSBldmVudEluaXRDb25maWc7XG5cbiAgICB0aGlzLnR5cGUgPSBgJHt0eXBlfWA7XG4gICAgdGhpcy50aW1lU3RhbXAgPSBEYXRlLm5vdygpO1xuICAgIHRoaXMudGFyZ2V0ID0gbnVsbDtcbiAgICB0aGlzLnNyY0VsZW1lbnQgPSBudWxsO1xuICAgIHRoaXMucmV0dXJuVmFsdWUgPSB0cnVlO1xuICAgIHRoaXMuaXNUcnVzdGVkID0gZmFsc2U7XG4gICAgdGhpcy5ldmVudFBoYXNlID0gMDtcbiAgICB0aGlzLmRlZmF1bHRQcmV2ZW50ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmN1cnJlbnRUYXJnZXQgPSBudWxsO1xuICAgIHRoaXMuY2FuY2VsYWJsZSA9IGNhbmNlbGFibGUgPyBCb29sZWFuKGNhbmNlbGFibGUpIDogZmFsc2U7XG4gICAgdGhpcy5jYW5jZWxCdWJibGUgPSBmYWxzZTtcbiAgICB0aGlzLmJ1YmJsZXMgPSBidWJibGVzID8gQm9vbGVhbihidWJibGVzKSA6IGZhbHNlO1xuICAgIHRoaXMuY29kZSA9IHR5cGVvZiBjb2RlID09PSAnbnVtYmVyJyA/IHBhcnNlSW50KGNvZGUsIDEwKSA6IDA7XG4gICAgdGhpcy5yZWFzb24gPSBgJHtyZWFzb24gfHwgJyd9YDtcbiAgICB0aGlzLndhc0NsZWFuID0gd2FzQ2xlYW4gPyBCb29sZWFuKHdhc0NsZWFuKSA6IGZhbHNlO1xuICB9XG59XG4iLCJpbXBvcnQgRXZlbnQgZnJvbSAnLi9ldmVudCc7XG5pbXBvcnQgTWVzc2FnZUV2ZW50IGZyb20gJy4vbWVzc2FnZSc7XG5pbXBvcnQgQ2xvc2VFdmVudCBmcm9tICcuL2Nsb3NlJztcblxuLypcbiAqIENyZWF0ZXMgYW4gRXZlbnQgb2JqZWN0IGFuZCBleHRlbmRzIGl0IHRvIGFsbG93IGZ1bGwgbW9kaWZpY2F0aW9uIG9mXG4gKiBpdHMgcHJvcGVydGllcy5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnIC0gd2l0aGluIGNvbmZpZyB5b3Ugd2lsbCBuZWVkIHRvIHBhc3MgdHlwZSBhbmQgb3B0aW9uYWxseSB0YXJnZXRcbiAqL1xuZnVuY3Rpb24gY3JlYXRlRXZlbnQoY29uZmlnKSB7XG4gIGNvbnN0IHsgdHlwZSwgdGFyZ2V0IH0gPSBjb25maWc7XG4gIGNvbnN0IGV2ZW50T2JqZWN0ID0gbmV3IEV2ZW50KHR5cGUpO1xuXG4gIGlmICh0YXJnZXQpIHtcbiAgICBldmVudE9iamVjdC50YXJnZXQgPSB0YXJnZXQ7XG4gICAgZXZlbnRPYmplY3Quc3JjRWxlbWVudCA9IHRhcmdldDtcbiAgICBldmVudE9iamVjdC5jdXJyZW50VGFyZ2V0ID0gdGFyZ2V0O1xuICB9XG5cbiAgcmV0dXJuIGV2ZW50T2JqZWN0O1xufVxuXG4vKlxuICogQ3JlYXRlcyBhIE1lc3NhZ2VFdmVudCBvYmplY3QgYW5kIGV4dGVuZHMgaXQgdG8gYWxsb3cgZnVsbCBtb2RpZmljYXRpb24gb2ZcbiAqIGl0cyBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWcgLSB3aXRoaW4gY29uZmlnOiB0eXBlLCBvcmlnaW4sIGRhdGEgYW5kIG9wdGlvbmFsbHkgdGFyZ2V0XG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZU1lc3NhZ2VFdmVudChjb25maWcpIHtcbiAgY29uc3QgeyB0eXBlLCBvcmlnaW4sIGRhdGEsIHRhcmdldCB9ID0gY29uZmlnO1xuICBjb25zdCBtZXNzYWdlRXZlbnQgPSBuZXcgTWVzc2FnZUV2ZW50KHR5cGUsIHtcbiAgICBkYXRhLFxuICAgIG9yaWdpblxuICB9KTtcblxuICBpZiAodGFyZ2V0KSB7XG4gICAgbWVzc2FnZUV2ZW50LnRhcmdldCA9IHRhcmdldDtcbiAgICBtZXNzYWdlRXZlbnQuc3JjRWxlbWVudCA9IHRhcmdldDtcbiAgICBtZXNzYWdlRXZlbnQuY3VycmVudFRhcmdldCA9IHRhcmdldDtcbiAgfVxuXG4gIHJldHVybiBtZXNzYWdlRXZlbnQ7XG59XG5cbi8qXG4gKiBDcmVhdGVzIGEgQ2xvc2VFdmVudCBvYmplY3QgYW5kIGV4dGVuZHMgaXQgdG8gYWxsb3cgZnVsbCBtb2RpZmljYXRpb24gb2ZcbiAqIGl0cyBwcm9wZXJ0aWVzLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWcgLSB3aXRoaW4gY29uZmlnOiB0eXBlIGFuZCBvcHRpb25hbGx5IHRhcmdldCwgY29kZSwgYW5kIHJlYXNvblxuICovXG5mdW5jdGlvbiBjcmVhdGVDbG9zZUV2ZW50KGNvbmZpZykge1xuICBjb25zdCB7IGNvZGUsIHJlYXNvbiwgdHlwZSwgdGFyZ2V0IH0gPSBjb25maWc7XG4gIGxldCB7IHdhc0NsZWFuIH0gPSBjb25maWc7XG5cbiAgaWYgKCF3YXNDbGVhbikge1xuICAgIHdhc0NsZWFuID0gY29kZSA9PT0gMTAwMDtcbiAgfVxuXG4gIGNvbnN0IGNsb3NlRXZlbnQgPSBuZXcgQ2xvc2VFdmVudCh0eXBlLCB7XG4gICAgY29kZSxcbiAgICByZWFzb24sXG4gICAgd2FzQ2xlYW5cbiAgfSk7XG5cbiAgaWYgKHRhcmdldCkge1xuICAgIGNsb3NlRXZlbnQudGFyZ2V0ID0gdGFyZ2V0O1xuICAgIGNsb3NlRXZlbnQuc3JjRWxlbWVudCA9IHRhcmdldDtcbiAgICBjbG9zZUV2ZW50LmN1cnJlbnRUYXJnZXQgPSB0YXJnZXQ7XG4gIH1cblxuICByZXR1cm4gY2xvc2VFdmVudDtcbn1cblxuZXhwb3J0IHsgY3JlYXRlRXZlbnQsIGNyZWF0ZU1lc3NhZ2VFdmVudCwgY3JlYXRlQ2xvc2VFdmVudCB9O1xuIiwiaW1wb3J0IFdlYlNvY2tldCBmcm9tICcuLi93ZWJzb2NrZXQnO1xuaW1wb3J0IGRlbGF5IGZyb20gJy4uL2hlbHBlcnMvZGVsYXknO1xuaW1wb3J0IG5ldHdvcmtCcmlkZ2UgZnJvbSAnLi4vbmV0d29yay1icmlkZ2UnO1xuaW1wb3J0IHsgY3JlYXRlQ2xvc2VFdmVudCwgY3JlYXRlRXZlbnQgfSBmcm9tICcuLi9ldmVudC9mYWN0b3J5JztcblxuZXhwb3J0IGZ1bmN0aW9uIGNsb3NlV2ViU29ja2V0Q29ubmVjdGlvbihjb250ZXh0LCBjb2RlLCByZWFzb24pIHtcbiAgY29udGV4dC5yZWFkeVN0YXRlID0gV2ViU29ja2V0LkNMT1NJTkc7XG5cbiAgY29uc3Qgc2VydmVyID0gbmV0d29ya0JyaWRnZS5zZXJ2ZXJMb29rdXAoY29udGV4dC51cmwpO1xuICBjb25zdCBjbG9zZUV2ZW50ID0gY3JlYXRlQ2xvc2VFdmVudCh7XG4gICAgdHlwZTogJ2Nsb3NlJyxcbiAgICB0YXJnZXQ6IGNvbnRleHQsXG4gICAgY29kZSxcbiAgICByZWFzb25cbiAgfSk7XG5cbiAgZGVsYXkoKCkgPT4ge1xuICAgIG5ldHdvcmtCcmlkZ2UucmVtb3ZlV2ViU29ja2V0KGNvbnRleHQsIGNvbnRleHQudXJsKTtcblxuICAgIGNvbnRleHQucmVhZHlTdGF0ZSA9IFdlYlNvY2tldC5DTE9TRUQ7XG4gICAgY29udGV4dC5kaXNwYXRjaEV2ZW50KGNsb3NlRXZlbnQpO1xuXG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgc2VydmVyLmRpc3BhdGNoRXZlbnQoY2xvc2VFdmVudCwgc2VydmVyKTtcbiAgICB9XG4gIH0sIGNvbnRleHQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmFpbFdlYlNvY2tldENvbm5lY3Rpb24oY29udGV4dCwgY29kZSwgcmVhc29uKSB7XG4gIGNvbnRleHQucmVhZHlTdGF0ZSA9IFdlYlNvY2tldC5DTE9TSU5HO1xuXG4gIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2Uuc2VydmVyTG9va3VwKGNvbnRleHQudXJsKTtcbiAgY29uc3QgY2xvc2VFdmVudCA9IGNyZWF0ZUNsb3NlRXZlbnQoe1xuICAgIHR5cGU6ICdjbG9zZScsXG4gICAgdGFyZ2V0OiBjb250ZXh0LFxuICAgIGNvZGUsXG4gICAgcmVhc29uLFxuICAgIHdhc0NsZWFuOiBmYWxzZVxuICB9KTtcblxuICBjb25zdCBlcnJvckV2ZW50ID0gY3JlYXRlRXZlbnQoe1xuICAgIHR5cGU6ICdlcnJvcicsXG4gICAgdGFyZ2V0OiBjb250ZXh0XG4gIH0pO1xuXG4gIGRlbGF5KCgpID0+IHtcbiAgICBuZXR3b3JrQnJpZGdlLnJlbW92ZVdlYlNvY2tldChjb250ZXh0LCBjb250ZXh0LnVybCk7XG5cbiAgICBjb250ZXh0LnJlYWR5U3RhdGUgPSBXZWJTb2NrZXQuQ0xPU0VEO1xuICAgIGNvbnRleHQuZGlzcGF0Y2hFdmVudChlcnJvckV2ZW50KTtcbiAgICBjb250ZXh0LmRpc3BhdGNoRXZlbnQoY2xvc2VFdmVudCk7XG5cbiAgICBpZiAoc2VydmVyKSB7XG4gICAgICBzZXJ2ZXIuZGlzcGF0Y2hFdmVudChjbG9zZUV2ZW50LCBzZXJ2ZXIpO1xuICAgIH1cbiAgfSwgY29udGV4dCk7XG59XG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBub3JtYWxpemVTZW5kRGF0YShkYXRhKSB7XG4gIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZGF0YSkgIT09ICdbb2JqZWN0IEJsb2JdJyAmJiAhKGRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikpIHtcbiAgICBkYXRhID0gU3RyaW5nKGRhdGEpO1xuICB9XG5cbiAgcmV0dXJuIGRhdGE7XG59XG4iLCJpbXBvcnQgeyBDTE9TRV9DT0RFUyB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5pbXBvcnQgeyBjbG9zZVdlYlNvY2tldENvbm5lY3Rpb24gfSBmcm9tICcuLi9hbGdvcml0aG1zL2Nsb3NlJztcbmltcG9ydCBub3JtYWxpemVTZW5kRGF0YSBmcm9tICcuL25vcm1hbGl6ZS1zZW5kJztcbmltcG9ydCB7IGNyZWF0ZU1lc3NhZ2VFdmVudCB9IGZyb20gJy4uL2V2ZW50L2ZhY3RvcnknO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBwcm94eUZhY3RvcnkodGFyZ2V0KSB7XG4gIGNvbnN0IGhhbmRsZXIgPSB7XG4gICAgZ2V0KG9iaiwgcHJvcCkge1xuICAgICAgaWYgKHByb3AgPT09ICdjbG9zZScpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIGNsb3NlKG9wdGlvbnMgPSB7fSkge1xuICAgICAgICAgIGNvbnN0IGNvZGUgPSBvcHRpb25zLmNvZGUgfHwgQ0xPU0VfQ09ERVMuQ0xPU0VfTk9STUFMO1xuICAgICAgICAgIGNvbnN0IHJlYXNvbiA9IG9wdGlvbnMucmVhc29uIHx8ICcnO1xuXG4gICAgICAgICAgY2xvc2VXZWJTb2NrZXRDb25uZWN0aW9uKHRhcmdldCwgY29kZSwgcmVhc29uKTtcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgaWYgKHByb3AgPT09ICdzZW5kJykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gc2VuZChkYXRhKSB7XG4gICAgICAgICAgZGF0YSA9IG5vcm1hbGl6ZVNlbmREYXRhKGRhdGEpO1xuXG4gICAgICAgICAgdGFyZ2V0LmRpc3BhdGNoRXZlbnQoXG4gICAgICAgICAgICBjcmVhdGVNZXNzYWdlRXZlbnQoe1xuICAgICAgICAgICAgICB0eXBlOiAnbWVzc2FnZScsXG4gICAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICAgIG9yaWdpbjogdGhpcy51cmwsXG4gICAgICAgICAgICAgIHRhcmdldFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICApO1xuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBpZiAocHJvcCA9PT0gJ29uJykge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gb25XcmFwcGVyKHR5cGUsIGNiKSB7XG4gICAgICAgICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoYHNlcnZlcjo6JHt0eXBlfWAsIGNiKTtcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG9ialtwcm9wXTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgcHJveHkgPSBuZXcgUHJveHkodGFyZ2V0LCBoYW5kbGVyKTtcbiAgcmV0dXJuIHByb3h5O1xufVxuIiwiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gbGVuZ3RoSW5VdGY4Qnl0ZXMoc3RyKSB7XG4gIC8vIE1hdGNoZXMgb25seSB0aGUgMTAuLiBieXRlcyB0aGF0IGFyZSBub24taW5pdGlhbCBjaGFyYWN0ZXJzIGluIGEgbXVsdGktYnl0ZSBzZXF1ZW5jZS5cbiAgY29uc3QgbSA9IGVuY29kZVVSSUNvbXBvbmVudChzdHIpLm1hdGNoKC8lWzg5QUJhYl0vZyk7XG4gIHJldHVybiBzdHIubGVuZ3RoICsgKG0gPyBtLmxlbmd0aCA6IDApO1xufVxuIiwiaW1wb3J0IFVSTCBmcm9tICd1cmwtcGFyc2UnO1xuaW1wb3J0IHsgRVJST1JfUFJFRklYIH0gZnJvbSAnLi4vY29uc3RhbnRzJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gdXJsVmVyaWZpY2F0aW9uKHVybCkge1xuICBjb25zdCB1cmxSZWNvcmQgPSBuZXcgVVJMKHVybCk7XG4gIGNvbnN0IHsgcGF0aG5hbWUsIHByb3RvY29sLCBoYXNoIH0gPSB1cmxSZWNvcmQ7XG5cbiAgaWYgKCF1cmwpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGAke0VSUk9SX1BSRUZJWC5DT05TVFJVQ1RPUl9FUlJPUn0gMSBhcmd1bWVudCByZXF1aXJlZCwgYnV0IG9ubHkgMCBwcmVzZW50LmApO1xuICB9XG5cbiAgaWYgKCFwYXRobmFtZSkge1xuICAgIHVybFJlY29yZC5wYXRobmFtZSA9ICcvJztcbiAgfVxuXG4gIGlmIChwcm90b2NvbCA9PT0gJycpIHtcbiAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYCR7RVJST1JfUFJFRklYLkNPTlNUUlVDVE9SX0VSUk9SfSBUaGUgVVJMICcke3VybFJlY29yZC50b1N0cmluZygpfScgaXMgaW52YWxpZC5gKTtcbiAgfVxuXG4gIGlmIChwcm90b2NvbCAhPT0gJ3dzOicgJiYgcHJvdG9jb2wgIT09ICd3c3M6Jykge1xuICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcbiAgICAgIGAke0VSUk9SX1BSRUZJWC5DT05TVFJVQ1RPUl9FUlJPUn0gVGhlIFVSTCdzIHNjaGVtZSBtdXN0IGJlIGVpdGhlciAnd3MnIG9yICd3c3MnLiAnJHtwcm90b2NvbH0nIGlzIG5vdCBhbGxvd2VkLmBcbiAgICApO1xuICB9XG5cbiAgaWYgKGhhc2ggIT09ICcnKSB7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbWF4LWxlbiAqL1xuICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcbiAgICAgIGAke1xuICAgICAgICBFUlJPUl9QUkVGSVguQ09OU1RSVUNUT1JfRVJST1JcbiAgICAgIH0gVGhlIFVSTCBjb250YWlucyBhIGZyYWdtZW50IGlkZW50aWZpZXIgKCcke2hhc2h9JykuIEZyYWdtZW50IGlkZW50aWZpZXJzIGFyZSBub3QgYWxsb3dlZCBpbiBXZWJTb2NrZXQgVVJMcy5gXG4gICAgKTtcbiAgICAvKiBlc2xpbnQtZW5hYmxlIG1heC1sZW4gKi9cbiAgfVxuXG4gIHJldHVybiB1cmxSZWNvcmQudG9TdHJpbmcoKTtcbn1cbiIsImltcG9ydCB7IEVSUk9SX1BSRUZJWCB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHByb3RvY29sVmVyaWZpY2F0aW9uKHByb3RvY29scyA9IFtdKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShwcm90b2NvbHMpICYmIHR5cGVvZiBwcm90b2NvbHMgIT09ICdzdHJpbmcnKSB7XG4gICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKGAke0VSUk9SX1BSRUZJWC5DT05TVFJVQ1RPUl9FUlJPUn0gVGhlIHN1YnByb3RvY29sICcke3Byb3RvY29scy50b1N0cmluZygpfScgaXMgaW52YWxpZC5gKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcHJvdG9jb2xzID09PSAnc3RyaW5nJykge1xuICAgIHByb3RvY29scyA9IFtwcm90b2NvbHNdO1xuICB9XG5cbiAgY29uc3QgdW5pcSA9IHByb3RvY29sc1xuICAgIC5tYXAocCA9PiAoeyBjb3VudDogMSwgcHJvdG9jb2w6IHAgfSkpXG4gICAgLnJlZHVjZSgoYSwgYikgPT4ge1xuICAgICAgYVtiLnByb3RvY29sXSA9IChhW2IucHJvdG9jb2xdIHx8IDApICsgYi5jb3VudDtcbiAgICAgIHJldHVybiBhO1xuICAgIH0sIHt9KTtcblxuICBjb25zdCBkdXBsaWNhdGVzID0gT2JqZWN0LmtleXModW5pcSkuZmlsdGVyKGEgPT4gdW5pcVthXSA+IDEpO1xuXG4gIGlmIChkdXBsaWNhdGVzLmxlbmd0aCA+IDApIHtcbiAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYCR7RVJST1JfUFJFRklYLkNPTlNUUlVDVE9SX0VSUk9SfSBUaGUgc3VicHJvdG9jb2wgJyR7ZHVwbGljYXRlc1swXX0nIGlzIGR1cGxpY2F0ZWQuYCk7XG4gIH1cblxuICByZXR1cm4gcHJvdG9jb2xzO1xufVxuIiwiaW1wb3J0IGRlbGF5IGZyb20gJy4vaGVscGVycy9kZWxheSc7XG5pbXBvcnQgbG9nZ2VyIGZyb20gJy4vaGVscGVycy9sb2dnZXInO1xuaW1wb3J0IEV2ZW50VGFyZ2V0IGZyb20gJy4vZXZlbnQvdGFyZ2V0JztcbmltcG9ydCBuZXR3b3JrQnJpZGdlIGZyb20gJy4vbmV0d29yay1icmlkZ2UnO1xuaW1wb3J0IHByb3h5RmFjdG9yeSBmcm9tICcuL2hlbHBlcnMvcHJveHktZmFjdG9yeSc7XG5pbXBvcnQgbGVuZ3RoSW5VdGY4Qnl0ZXMgZnJvbSAnLi9oZWxwZXJzL2J5dGUtbGVuZ3RoJztcbmltcG9ydCB7IENMT1NFX0NPREVTLCBFUlJPUl9QUkVGSVggfSBmcm9tICcuL2NvbnN0YW50cyc7XG5pbXBvcnQgdXJsVmVyaWZpY2F0aW9uIGZyb20gJy4vaGVscGVycy91cmwtdmVyaWZpY2F0aW9uJztcbmltcG9ydCBub3JtYWxpemVTZW5kRGF0YSBmcm9tICcuL2hlbHBlcnMvbm9ybWFsaXplLXNlbmQnO1xuaW1wb3J0IHByb3RvY29sVmVyaWZpY2F0aW9uIGZyb20gJy4vaGVscGVycy9wcm90b2NvbC12ZXJpZmljYXRpb24nO1xuaW1wb3J0IHsgY3JlYXRlRXZlbnQsIGNyZWF0ZU1lc3NhZ2VFdmVudCwgY3JlYXRlQ2xvc2VFdmVudCB9IGZyb20gJy4vZXZlbnQvZmFjdG9yeSc7XG5pbXBvcnQgeyBjbG9zZVdlYlNvY2tldENvbm5lY3Rpb24sIGZhaWxXZWJTb2NrZXRDb25uZWN0aW9uIH0gZnJvbSAnLi9hbGdvcml0aG1zL2Nsb3NlJztcblxuLypcbiAqIFRoZSBtYWluIHdlYnNvY2tldCBjbGFzcyB3aGljaCBpcyBkZXNpZ25lZCB0byBtaW1pY2sgdGhlIG5hdGl2ZSBXZWJTb2NrZXQgY2xhc3MgYXMgY2xvc2VcbiAqIGFzIHBvc3NpYmxlLlxuICpcbiAqIGh0dHBzOi8vaHRtbC5zcGVjLndoYXR3Zy5vcmcvbXVsdGlwYWdlL3dlYi1zb2NrZXRzLmh0bWxcbiAqL1xuY2xhc3MgV2ViU29ja2V0IGV4dGVuZHMgRXZlbnRUYXJnZXQge1xuICBjb25zdHJ1Y3Rvcih1cmwsIHByb3RvY29scykge1xuICAgIHN1cGVyKCk7XG5cbiAgICB0aGlzLnVybCA9IHVybFZlcmlmaWNhdGlvbih1cmwpO1xuICAgIHByb3RvY29scyA9IHByb3RvY29sVmVyaWZpY2F0aW9uKHByb3RvY29scyk7XG4gICAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sc1swXSB8fCAnJztcblxuICAgIHRoaXMuYmluYXJ5VHlwZSA9ICdibG9iJztcbiAgICB0aGlzLnJlYWR5U3RhdGUgPSBXZWJTb2NrZXQuQ09OTkVDVElORztcblxuICAgIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2UuYXR0YWNoV2ViU29ja2V0KHRoaXMsIHRoaXMudXJsKTtcblxuICAgIC8qXG4gICAgICogVGhpcyBkZWxheSBpcyBuZWVkZWQgc28gdGhhdCB3ZSBkb250IHRyaWdnZXIgYW4gZXZlbnQgYmVmb3JlIHRoZSBjYWxsYmFja3MgaGF2ZSBiZWVuXG4gICAgICogc2V0dXAuIEZvciBleGFtcGxlOlxuICAgICAqXG4gICAgICogdmFyIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQoJ3dzOi8vbG9jYWxob3N0Jyk7XG4gICAgICpcbiAgICAgKiBJZiB3ZSBkb250IGhhdmUgdGhlIGRlbGF5IHRoZW4gdGhlIGV2ZW50IHdvdWxkIGJlIHRyaWdnZXJlZCByaWdodCBoZXJlIGFuZCB0aGlzIGlzXG4gICAgICogYmVmb3JlIHRoZSBvbm9wZW4gaGFkIGEgY2hhbmNlIHRvIHJlZ2lzdGVyIGl0c2VsZi5cbiAgICAgKlxuICAgICAqIHNvY2tldC5vbm9wZW4gPSAoKSA9PiB7IC8vIHRoaXMgd291bGQgbmV2ZXIgYmUgY2FsbGVkIH07XG4gICAgICpcbiAgICAgKiBhbmQgd2l0aCB0aGUgZGVsYXkgdGhlIGV2ZW50IGdldHMgdHJpZ2dlcmVkIGhlcmUgYWZ0ZXIgYWxsIG9mIHRoZSBjYWxsYmFja3MgaGF2ZSBiZWVuXG4gICAgICogcmVnaXN0ZXJlZCA6LSlcbiAgICAgKi9cbiAgICBkZWxheShmdW5jdGlvbiBkZWxheUNhbGxiYWNrKCkge1xuICAgICAgaWYgKHNlcnZlcikge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgc2VydmVyLm9wdGlvbnMudmVyaWZ5Q2xpZW50ICYmXG4gICAgICAgICAgdHlwZW9mIHNlcnZlci5vcHRpb25zLnZlcmlmeUNsaWVudCA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICAgICFzZXJ2ZXIub3B0aW9ucy52ZXJpZnlDbGllbnQoKVxuICAgICAgICApIHtcbiAgICAgICAgICB0aGlzLnJlYWR5U3RhdGUgPSBXZWJTb2NrZXQuQ0xPU0VEO1xuXG4gICAgICAgICAgbG9nZ2VyKFxuICAgICAgICAgICAgJ2Vycm9yJyxcbiAgICAgICAgICAgIGBXZWJTb2NrZXQgY29ubmVjdGlvbiB0byAnJHt0aGlzLnVybH0nIGZhaWxlZDogSFRUUCBBdXRoZW50aWNhdGlvbiBmYWlsZWQ7IG5vIHZhbGlkIGNyZWRlbnRpYWxzIGF2YWlsYWJsZWBcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgbmV0d29ya0JyaWRnZS5yZW1vdmVXZWJTb2NrZXQodGhpcywgdGhpcy51cmwpO1xuICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjcmVhdGVFdmVudCh7IHR5cGU6ICdlcnJvcicsIHRhcmdldDogdGhpcyB9KSk7XG4gICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUNsb3NlRXZlbnQoeyB0eXBlOiAnY2xvc2UnLCB0YXJnZXQ6IHRoaXMsIGNvZGU6IENMT1NFX0NPREVTLkNMT1NFX05PUk1BTCB9KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHNlcnZlci5vcHRpb25zLnNlbGVjdFByb3RvY29sICYmIHR5cGVvZiBzZXJ2ZXIub3B0aW9ucy5zZWxlY3RQcm90b2NvbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWRQcm90b2NvbCA9IHNlcnZlci5vcHRpb25zLnNlbGVjdFByb3RvY29sKHByb3RvY29scyk7XG4gICAgICAgICAgICBjb25zdCBpc0ZpbGxlZCA9IHNlbGVjdGVkUHJvdG9jb2wgIT09ICcnO1xuICAgICAgICAgICAgY29uc3QgaXNSZXF1ZXN0ZWQgPSBwcm90b2NvbHMuaW5kZXhPZihzZWxlY3RlZFByb3RvY29sKSAhPT0gLTE7XG4gICAgICAgICAgICBpZiAoaXNGaWxsZWQgJiYgIWlzUmVxdWVzdGVkKSB7XG4gICAgICAgICAgICAgIHRoaXMucmVhZHlTdGF0ZSA9IFdlYlNvY2tldC5DTE9TRUQ7XG5cbiAgICAgICAgICAgICAgbG9nZ2VyKCdlcnJvcicsIGBXZWJTb2NrZXQgY29ubmVjdGlvbiB0byAnJHt0aGlzLnVybH0nIGZhaWxlZDogSW52YWxpZCBTdWItUHJvdG9jb2xgKTtcblxuICAgICAgICAgICAgICBuZXR3b3JrQnJpZGdlLnJlbW92ZVdlYlNvY2tldCh0aGlzLCB0aGlzLnVybCk7XG4gICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjcmVhdGVFdmVudCh7IHR5cGU6ICdlcnJvcicsIHRhcmdldDogdGhpcyB9KSk7XG4gICAgICAgICAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjcmVhdGVDbG9zZUV2ZW50KHsgdHlwZTogJ2Nsb3NlJywgdGFyZ2V0OiB0aGlzLCBjb2RlOiBDTE9TRV9DT0RFUy5DTE9TRV9OT1JNQUwgfSkpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnByb3RvY29sID0gc2VsZWN0ZWRQcm90b2NvbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gV2ViU29ja2V0Lk9QRU47XG4gICAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUV2ZW50KHsgdHlwZTogJ29wZW4nLCB0YXJnZXQ6IHRoaXMgfSkpO1xuICAgICAgICAgIHNlcnZlci5kaXNwYXRjaEV2ZW50KGNyZWF0ZUV2ZW50KHsgdHlwZTogJ2Nvbm5lY3Rpb24nIH0pLCBwcm94eUZhY3RvcnkodGhpcykpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJlYWR5U3RhdGUgPSBXZWJTb2NrZXQuQ0xPU0VEO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoY3JlYXRlRXZlbnQoeyB0eXBlOiAnZXJyb3InLCB0YXJnZXQ6IHRoaXMgfSkpO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoY3JlYXRlQ2xvc2VFdmVudCh7IHR5cGU6ICdjbG9zZScsIHRhcmdldDogdGhpcywgY29kZTogQ0xPU0VfQ09ERVMuQ0xPU0VfTk9STUFMIH0pKTtcblxuICAgICAgICBsb2dnZXIoJ2Vycm9yJywgYFdlYlNvY2tldCBjb25uZWN0aW9uIHRvICcke3RoaXMudXJsfScgZmFpbGVkYCk7XG4gICAgICB9XG4gICAgfSwgdGhpcyk7XG4gIH1cblxuICBnZXQgb25vcGVuKCkge1xuICAgIHJldHVybiB0aGlzLmxpc3RlbmVycy5vcGVuO1xuICB9XG5cbiAgZ2V0IG9ubWVzc2FnZSgpIHtcbiAgICByZXR1cm4gdGhpcy5saXN0ZW5lcnMubWVzc2FnZTtcbiAgfVxuXG4gIGdldCBvbmNsb3NlKCkge1xuICAgIHJldHVybiB0aGlzLmxpc3RlbmVycy5jbG9zZTtcbiAgfVxuXG4gIGdldCBvbmVycm9yKCkge1xuICAgIHJldHVybiB0aGlzLmxpc3RlbmVycy5lcnJvcjtcbiAgfVxuXG4gIHNldCBvbm9wZW4obGlzdGVuZXIpIHtcbiAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnMub3BlbjtcbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ29wZW4nLCBsaXN0ZW5lcik7XG4gIH1cblxuICBzZXQgb25tZXNzYWdlKGxpc3RlbmVyKSB7XG4gICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzLm1lc3NhZ2U7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgbGlzdGVuZXIpO1xuICB9XG5cbiAgc2V0IG9uY2xvc2UobGlzdGVuZXIpIHtcbiAgICBkZWxldGUgdGhpcy5saXN0ZW5lcnMuY2xvc2U7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCdjbG9zZScsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHNldCBvbmVycm9yKGxpc3RlbmVyKSB7XG4gICAgZGVsZXRlIHRoaXMubGlzdGVuZXJzLmVycm9yO1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBsaXN0ZW5lcik7XG4gIH1cblxuICBzZW5kKGRhdGEpIHtcbiAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuQ0xPU0lORyB8fCB0aGlzLnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5DTE9TRUQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignV2ViU29ja2V0IGlzIGFscmVhZHkgaW4gQ0xPU0lORyBvciBDTE9TRUQgc3RhdGUnKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBoYW5kbGUgYnVmZmVyZWRBbW91bnRcblxuICAgIGNvbnN0IG1lc3NhZ2VFdmVudCA9IGNyZWF0ZU1lc3NhZ2VFdmVudCh7XG4gICAgICB0eXBlOiAnc2VydmVyOjptZXNzYWdlJyxcbiAgICAgIG9yaWdpbjogdGhpcy51cmwsXG4gICAgICBkYXRhOiBub3JtYWxpemVTZW5kRGF0YShkYXRhKVxuICAgIH0pO1xuXG4gICAgY29uc3Qgc2VydmVyID0gbmV0d29ya0JyaWRnZS5zZXJ2ZXJMb29rdXAodGhpcy51cmwpO1xuXG4gICAgaWYgKHNlcnZlcikge1xuICAgICAgZGVsYXkoKCkgPT4ge1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQobWVzc2FnZUV2ZW50LCBkYXRhKTtcbiAgICAgIH0sIHNlcnZlcik7XG4gICAgfVxuICB9XG5cbiAgY2xvc2UoY29kZSwgcmVhc29uKSB7XG4gICAgaWYgKGNvZGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKHR5cGVvZiBjb2RlICE9PSAnbnVtYmVyJyB8fCAoY29kZSAhPT0gMTAwMCAmJiAoY29kZSA8IDMwMDAgfHwgY29kZSA+IDQ5OTkpKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGAke0VSUk9SX1BSRUZJWC5DTE9TRV9FUlJPUn0gVGhlIGNvZGUgbXVzdCBiZSBlaXRoZXIgMTAwMCwgb3IgYmV0d2VlbiAzMDAwIGFuZCA0OTk5LiAke2NvZGV9IGlzIG5laXRoZXIuYFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChyZWFzb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgY29uc3QgbGVuZ3RoID0gbGVuZ3RoSW5VdGY4Qnl0ZXMocmVhc29uKTtcblxuICAgICAgaWYgKGxlbmd0aCA+IDEyMykge1xuICAgICAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoYCR7RVJST1JfUFJFRklYLkNMT1NFX0VSUk9SfSBUaGUgbWVzc2FnZSBtdXN0IG5vdCBiZSBncmVhdGVyIHRoYW4gMTIzIGJ5dGVzLmApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5DTE9TSU5HIHx8IHRoaXMucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0LkNMT1NFRCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5DT05ORUNUSU5HKSB7XG4gICAgICBmYWlsV2ViU29ja2V0Q29ubmVjdGlvbih0aGlzLCBjb2RlLCByZWFzb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjbG9zZVdlYlNvY2tldENvbm5lY3Rpb24odGhpcywgY29kZSwgcmVhc29uKTtcbiAgICB9XG4gIH1cbn1cblxuV2ViU29ja2V0LkNPTk5FQ1RJTkcgPSAwO1xuV2ViU29ja2V0LnByb3RvdHlwZS5DT05ORUNUSU5HID0gV2ViU29ja2V0LkNPTk5FQ1RJTkc7XG5XZWJTb2NrZXQuT1BFTiA9IDE7XG5XZWJTb2NrZXQucHJvdG90eXBlLk9QRU4gPSBXZWJTb2NrZXQuT1BFTjtcbldlYlNvY2tldC5DTE9TSU5HID0gMjtcbldlYlNvY2tldC5wcm90b3R5cGUuQ0xPU0lORyA9IFdlYlNvY2tldC5DTE9TSU5HO1xuV2ViU29ja2V0LkNMT1NFRCA9IDM7XG5XZWJTb2NrZXQucHJvdG90eXBlLkNMT1NFRCA9IFdlYlNvY2tldC5DTE9TRUQ7XG5cbmV4cG9ydCBkZWZhdWx0IFdlYlNvY2tldDtcbiIsImV4cG9ydCBkZWZhdWx0IGFyciA9PlxuICBhcnIucmVkdWNlKChkZWR1cGVkLCBiKSA9PiB7XG4gICAgaWYgKGRlZHVwZWQuaW5kZXhPZihiKSA+IC0xKSByZXR1cm4gZGVkdXBlZDtcbiAgICByZXR1cm4gZGVkdXBlZC5jb25jYXQoYik7XG4gIH0sIFtdKTtcbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJldHJpZXZlR2xvYmFsT2JqZWN0KCkge1xuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gd2luZG93O1xuICB9XG5cbiAgcmV0dXJuIHR5cGVvZiBwcm9jZXNzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZ2xvYmFsID09PSAnb2JqZWN0JyA/IGdsb2JhbCA6IHRoaXM7XG59XG4iLCJpbXBvcnQgVVJMIGZyb20gJ3VybC1wYXJzZSc7XG5pbXBvcnQgV2ViU29ja2V0IGZyb20gJy4vd2Vic29ja2V0JztcbmltcG9ydCBkZWR1cGUgZnJvbSAnLi9oZWxwZXJzL2RlZHVwZSc7XG5pbXBvcnQgRXZlbnRUYXJnZXQgZnJvbSAnLi9ldmVudC90YXJnZXQnO1xuaW1wb3J0IHsgQ0xPU0VfQ09ERVMgfSBmcm9tICcuL2NvbnN0YW50cyc7XG5pbXBvcnQgbmV0d29ya0JyaWRnZSBmcm9tICcuL25ldHdvcmstYnJpZGdlJztcbmltcG9ydCBnbG9iYWxPYmplY3QgZnJvbSAnLi9oZWxwZXJzL2dsb2JhbC1vYmplY3QnO1xuaW1wb3J0IG5vcm1hbGl6ZVNlbmREYXRhIGZyb20gJy4vaGVscGVycy9ub3JtYWxpemUtc2VuZCc7XG5pbXBvcnQgeyBjcmVhdGVFdmVudCwgY3JlYXRlTWVzc2FnZUV2ZW50LCBjcmVhdGVDbG9zZUV2ZW50IH0gZnJvbSAnLi9ldmVudC9mYWN0b3J5JztcblxuY2xhc3MgU2VydmVyIGV4dGVuZHMgRXZlbnRUYXJnZXQge1xuICBjb25zdHJ1Y3Rvcih1cmwsIG9wdGlvbnMgPSB7fSkge1xuICAgIHN1cGVyKCk7XG4gICAgY29uc3QgdXJsUmVjb3JkID0gbmV3IFVSTCh1cmwpO1xuXG4gICAgaWYgKCF1cmxSZWNvcmQucGF0aG5hbWUpIHtcbiAgICAgIHVybFJlY29yZC5wYXRobmFtZSA9ICcvJztcbiAgICB9XG5cbiAgICB0aGlzLnVybCA9IHVybFJlY29yZC50b1N0cmluZygpO1xuXG4gICAgdGhpcy5vcmlnaW5hbFdlYlNvY2tldCA9IG51bGw7XG4gICAgY29uc3Qgc2VydmVyID0gbmV0d29ya0JyaWRnZS5hdHRhY2hTZXJ2ZXIodGhpcywgdGhpcy51cmwpO1xuXG4gICAgaWYgKCFzZXJ2ZXIpIHtcbiAgICAgIHRoaXMuZGlzcGF0Y2hFdmVudChjcmVhdGVFdmVudCh7IHR5cGU6ICdlcnJvcicgfSkpO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBIG1vY2sgc2VydmVyIGlzIGFscmVhZHkgbGlzdGVuaW5nIG9uIHRoaXMgdXJsJyk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLnZlcmlmeUNsaWVudCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIG9wdGlvbnMudmVyaWZ5Q2xpZW50ID0gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuc2VsZWN0UHJvdG9jb2wgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBvcHRpb25zLnNlbGVjdFByb3RvY29sID0gbnVsbDtcbiAgICB9XG5cbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuc3RhcnQoKTtcbiAgfVxuXG4gIC8qXG4gICAqIEF0dGFjaGVzIHRoZSBtb2NrIHdlYnNvY2tldCBvYmplY3QgdG8gdGhlIGdsb2JhbCBvYmplY3RcbiAgICovXG4gIHN0YXJ0KCkge1xuICAgIGNvbnN0IGdsb2JhbE9iaiA9IGdsb2JhbE9iamVjdCgpO1xuXG4gICAgaWYgKGdsb2JhbE9iai5XZWJTb2NrZXQpIHtcbiAgICAgIHRoaXMub3JpZ2luYWxXZWJTb2NrZXQgPSBnbG9iYWxPYmouV2ViU29ja2V0O1xuICAgIH1cblxuICAgIGdsb2JhbE9iai5XZWJTb2NrZXQgPSBXZWJTb2NrZXQ7XG4gIH1cblxuICAvKlxuICAgKiBSZW1vdmVzIHRoZSBtb2NrIHdlYnNvY2tldCBvYmplY3QgZnJvbSB0aGUgZ2xvYmFsIG9iamVjdFxuICAgKi9cbiAgc3RvcChjYWxsYmFjayA9ICgpID0+IHt9KSB7XG4gICAgY29uc3QgZ2xvYmFsT2JqID0gZ2xvYmFsT2JqZWN0KCk7XG5cbiAgICBpZiAodGhpcy5vcmlnaW5hbFdlYlNvY2tldCkge1xuICAgICAgZ2xvYmFsT2JqLldlYlNvY2tldCA9IHRoaXMub3JpZ2luYWxXZWJTb2NrZXQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZSBnbG9iYWxPYmouV2ViU29ja2V0O1xuICAgIH1cblxuICAgIHRoaXMub3JpZ2luYWxXZWJTb2NrZXQgPSBudWxsO1xuXG4gICAgbmV0d29ya0JyaWRnZS5yZW1vdmVTZXJ2ZXIodGhpcy51cmwpO1xuXG4gICAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2soKTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAgKiBUaGlzIGlzIHRoZSBtYWluIGZ1bmN0aW9uIGZvciB0aGUgbW9jayBzZXJ2ZXIgdG8gc3Vic2NyaWJlIHRvIHRoZSBvbiBldmVudHMuXG4gICAqXG4gICAqIGllOiBtb2NrU2VydmVyLm9uKCdjb25uZWN0aW9uJywgZnVuY3Rpb24oKSB7IGNvbnNvbGUubG9nKCdhIG1vY2sgY2xpZW50IGNvbm5lY3RlZCcpOyB9KTtcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUaGUgZXZlbnQga2V5IHRvIHN1YnNjcmliZSB0by4gVmFsaWQga2V5cyBhcmU6IGNvbm5lY3Rpb24sIG1lc3NhZ2UsIGFuZCBjbG9zZS5cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBUaGUgY2FsbGJhY2sgd2hpY2ggc2hvdWxkIGJlIGNhbGxlZCB3aGVuIGEgY2VydGFpbiBldmVudCBpcyBmaXJlZC5cbiAgICovXG4gIG9uKHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIC8qXG4gICAqIENsb3NlcyB0aGUgY29ubmVjdGlvbiBhbmQgdHJpZ2dlcnMgdGhlIG9uY2xvc2UgbWV0aG9kIG9mIGFsbCBsaXN0ZW5pbmdcbiAgICogd2Vic29ja2V0cy4gQWZ0ZXIgdGhhdCBpdCByZW1vdmVzIGl0c2VsZiBmcm9tIHRoZSB1cmxNYXAgc28gYW5vdGhlciBzZXJ2ZXJcbiAgICogY291bGQgYWRkIGl0c2VsZiB0byB0aGUgdXJsLlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9uc1xuICAgKi9cbiAgY2xvc2Uob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgeyBjb2RlLCByZWFzb24sIHdhc0NsZWFuIH0gPSBvcHRpb25zO1xuICAgIGNvbnN0IGxpc3RlbmVycyA9IG5ldHdvcmtCcmlkZ2Uud2Vic29ja2V0c0xvb2t1cCh0aGlzLnVybCk7XG5cbiAgICAvLyBSZW1vdmUgc2VydmVyIGJlZm9yZSBub3RpZmljYXRpb25zIHRvIHByZXZlbnQgaW1tZWRpYXRlIHJlY29ubmVjdHMgZnJvbVxuICAgIC8vIHNvY2tldCBvbmNsb3NlIGhhbmRsZXJzXG4gICAgbmV0d29ya0JyaWRnZS5yZW1vdmVTZXJ2ZXIodGhpcy51cmwpO1xuXG4gICAgbGlzdGVuZXJzLmZvckVhY2goc29ja2V0ID0+IHtcbiAgICAgIHNvY2tldC5yZWFkeVN0YXRlID0gV2ViU29ja2V0LkNMT1NFO1xuICAgICAgc29ja2V0LmRpc3BhdGNoRXZlbnQoXG4gICAgICAgIGNyZWF0ZUNsb3NlRXZlbnQoe1xuICAgICAgICAgIHR5cGU6ICdjbG9zZScsXG4gICAgICAgICAgdGFyZ2V0OiBzb2NrZXQsXG4gICAgICAgICAgY29kZTogY29kZSB8fCBDTE9TRV9DT0RFUy5DTE9TRV9OT1JNQUwsXG4gICAgICAgICAgcmVhc29uOiByZWFzb24gfHwgJycsXG4gICAgICAgICAgd2FzQ2xlYW5cbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoY3JlYXRlQ2xvc2VFdmVudCh7IHR5cGU6ICdjbG9zZScgfSksIHRoaXMpO1xuICB9XG5cbiAgLypcbiAgICogU2VuZHMgYSBnZW5lcmljIG1lc3NhZ2UgZXZlbnQgdG8gYWxsIG1vY2sgY2xpZW50cy5cbiAgICovXG4gIGVtaXQoZXZlbnQsIGRhdGEsIG9wdGlvbnMgPSB7fSkge1xuICAgIGxldCB7IHdlYnNvY2tldHMgfSA9IG9wdGlvbnM7XG5cbiAgICBpZiAoIXdlYnNvY2tldHMpIHtcbiAgICAgIHdlYnNvY2tldHMgPSBuZXR3b3JrQnJpZGdlLndlYnNvY2tldHNMb29rdXAodGhpcy51cmwpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcgfHwgYXJndW1lbnRzLmxlbmd0aCA+IDMpIHtcbiAgICAgIGRhdGEgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEsIGFyZ3VtZW50cy5sZW5ndGgpO1xuICAgICAgZGF0YSA9IGRhdGEubWFwKGl0ZW0gPT4gbm9ybWFsaXplU2VuZERhdGEoaXRlbSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkYXRhID0gbm9ybWFsaXplU2VuZERhdGEoZGF0YSk7XG4gICAgfVxuXG4gICAgd2Vic29ja2V0cy5mb3JFYWNoKHNvY2tldCA9PiB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgICBzb2NrZXQuZGlzcGF0Y2hFdmVudChcbiAgICAgICAgICBjcmVhdGVNZXNzYWdlRXZlbnQoe1xuICAgICAgICAgICAgdHlwZTogZXZlbnQsXG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgb3JpZ2luOiB0aGlzLnVybCxcbiAgICAgICAgICAgIHRhcmdldDogc29ja2V0XG4gICAgICAgICAgfSksXG4gICAgICAgICAgLi4uZGF0YVxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc29ja2V0LmRpc3BhdGNoRXZlbnQoXG4gICAgICAgICAgY3JlYXRlTWVzc2FnZUV2ZW50KHtcbiAgICAgICAgICAgIHR5cGU6IGV2ZW50LFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIG9yaWdpbjogdGhpcy51cmwsXG4gICAgICAgICAgICB0YXJnZXQ6IHNvY2tldFxuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKlxuICAgKiBSZXR1cm5zIGFuIGFycmF5IG9mIHdlYnNvY2tldHMgd2hpY2ggYXJlIGxpc3RlbmluZyB0byB0aGlzIHNlcnZlclxuICAgKiBUT09EOiB0aGlzIHNob3VsZCByZXR1cm4gYSBzZXQgYW5kIG5vdCBiZSBhIG1ldGhvZFxuICAgKi9cbiAgY2xpZW50cygpIHtcbiAgICByZXR1cm4gbmV0d29ya0JyaWRnZS53ZWJzb2NrZXRzTG9va3VwKHRoaXMudXJsKTtcbiAgfVxuXG4gIC8qXG4gICAqIFByZXBhcmVzIGEgbWV0aG9kIHRvIHN1Ym1pdCBhbiBldmVudCB0byBtZW1iZXJzIG9mIHRoZSByb29tXG4gICAqXG4gICAqIGUuZy4gc2VydmVyLnRvKCdteS1yb29tJykuZW1pdCgnaGkhJyk7XG4gICAqL1xuICB0byhyb29tLCBicm9hZGNhc3RlciwgYnJvYWRjYXN0TGlzdCA9IFtdKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgd2Vic29ja2V0cyA9IGRlZHVwZShicm9hZGNhc3RMaXN0LmNvbmNhdChuZXR3b3JrQnJpZGdlLndlYnNvY2tldHNMb29rdXAodGhpcy51cmwsIHJvb20sIGJyb2FkY2FzdGVyKSkpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHRvOiAoY2hhaW5lZFJvb20sIGNoYWluZWRCcm9hZGNhc3RlcikgPT4gdGhpcy50by5jYWxsKHRoaXMsIGNoYWluZWRSb29tLCBjaGFpbmVkQnJvYWRjYXN0ZXIsIHdlYnNvY2tldHMpLFxuICAgICAgZW1pdChldmVudCwgZGF0YSkge1xuICAgICAgICBzZWxmLmVtaXQoZXZlbnQsIGRhdGEsIHsgd2Vic29ja2V0cyB9KTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgLypcbiAgICogQWxpYXMgZm9yIFNlcnZlci50b1xuICAgKi9cbiAgaW4oLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLnRvLmFwcGx5KG51bGwsIGFyZ3MpO1xuICB9XG5cbiAgLypcbiAgICogU2ltdWxhdGUgYW4gZXZlbnQgZnJvbSB0aGUgc2VydmVyIHRvIHRoZSBjbGllbnRzLiBVc2VmdWwgZm9yXG4gICAqIHNpbXVsYXRpbmcgZXJyb3JzLlxuICAgKi9cbiAgc2ltdWxhdGUoZXZlbnQpIHtcbiAgICBjb25zdCBsaXN0ZW5lcnMgPSBuZXR3b3JrQnJpZGdlLndlYnNvY2tldHNMb29rdXAodGhpcy51cmwpO1xuXG4gICAgaWYgKGV2ZW50ID09PSAnZXJyb3InKSB7XG4gICAgICBsaXN0ZW5lcnMuZm9yRWFjaChzb2NrZXQgPT4ge1xuICAgICAgICBzb2NrZXQucmVhZHlTdGF0ZSA9IFdlYlNvY2tldC5DTE9TRTtcbiAgICAgICAgc29ja2V0LmRpc3BhdGNoRXZlbnQoY3JlYXRlRXZlbnQoeyB0eXBlOiAnZXJyb3InIH0pKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG4vKlxuICogQWx0ZXJuYXRpdmUgY29uc3RydWN0b3IgdG8gc3VwcG9ydCBuYW1lc3BhY2VzIGluIHNvY2tldC5pb1xuICpcbiAqIGh0dHA6Ly9zb2NrZXQuaW8vZG9jcy9yb29tcy1hbmQtbmFtZXNwYWNlcy8jY3VzdG9tLW5hbWVzcGFjZXNcbiAqL1xuU2VydmVyLm9mID0gZnVuY3Rpb24gb2YodXJsKSB7XG4gIHJldHVybiBuZXcgU2VydmVyKHVybCk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBTZXJ2ZXI7XG4iLCJpbXBvcnQgVVJMIGZyb20gJ3VybC1wYXJzZSc7XG5pbXBvcnQgZGVsYXkgZnJvbSAnLi9oZWxwZXJzL2RlbGF5JztcbmltcG9ydCBFdmVudFRhcmdldCBmcm9tICcuL2V2ZW50L3RhcmdldCc7XG5pbXBvcnQgbmV0d29ya0JyaWRnZSBmcm9tICcuL25ldHdvcmstYnJpZGdlJztcbmltcG9ydCB7IENMT1NFX0NPREVTIH0gZnJvbSAnLi9jb25zdGFudHMnO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuL2hlbHBlcnMvbG9nZ2VyJztcbmltcG9ydCB7IGNyZWF0ZUV2ZW50LCBjcmVhdGVNZXNzYWdlRXZlbnQsIGNyZWF0ZUNsb3NlRXZlbnQgfSBmcm9tICcuL2V2ZW50L2ZhY3RvcnknO1xuXG4vKlxuICogVGhlIHNvY2tldC1pbyBjbGFzcyBpcyBkZXNpZ25lZCB0byBtaW1pY2sgdGhlIHJlYWwgQVBJIGFzIGNsb3NlbHkgYXMgcG9zc2libGUuXG4gKlxuICogaHR0cDovL3NvY2tldC5pby9kb2NzL1xuICovXG5jbGFzcyBTb2NrZXRJTyBleHRlbmRzIEV2ZW50VGFyZ2V0IHtcbiAgLypcbiAgICogQHBhcmFtIHtzdHJpbmd9IHVybFxuICAgKi9cbiAgY29uc3RydWN0b3IodXJsID0gJ3NvY2tldC5pbycsIHByb3RvY29sID0gJycpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5iaW5hcnlUeXBlID0gJ2Jsb2InO1xuICAgIGNvbnN0IHVybFJlY29yZCA9IG5ldyBVUkwodXJsKTtcblxuICAgIGlmICghdXJsUmVjb3JkLnBhdGhuYW1lKSB7XG4gICAgICB1cmxSZWNvcmQucGF0aG5hbWUgPSAnLyc7XG4gICAgfVxuXG4gICAgdGhpcy51cmwgPSB1cmxSZWNvcmQudG9TdHJpbmcoKTtcbiAgICB0aGlzLnJlYWR5U3RhdGUgPSBTb2NrZXRJTy5DT05ORUNUSU5HO1xuICAgIHRoaXMucHJvdG9jb2wgPSAnJztcblxuICAgIGlmICh0eXBlb2YgcHJvdG9jb2wgPT09ICdzdHJpbmcnIHx8ICh0eXBlb2YgcHJvdG9jb2wgPT09ICdvYmplY3QnICYmIHByb3RvY29sICE9PSBudWxsKSkge1xuICAgICAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShwcm90b2NvbCkgJiYgcHJvdG9jb2wubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sWzBdO1xuICAgIH1cblxuICAgIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2UuYXR0YWNoV2ViU29ja2V0KHRoaXMsIHRoaXMudXJsKTtcblxuICAgIC8qXG4gICAgICogRGVsYXkgdHJpZ2dlcmluZyB0aGUgY29ubmVjdGlvbiBldmVudHMgc28gdGhleSBjYW4gYmUgZGVmaW5lZCBpbiB0aW1lLlxuICAgICAqL1xuICAgIGRlbGF5KGZ1bmN0aW9uIGRlbGF5Q2FsbGJhY2soKSB7XG4gICAgICBpZiAoc2VydmVyKSB7XG4gICAgICAgIHRoaXMucmVhZHlTdGF0ZSA9IFNvY2tldElPLk9QRU47XG4gICAgICAgIHNlcnZlci5kaXNwYXRjaEV2ZW50KGNyZWF0ZUV2ZW50KHsgdHlwZTogJ2Nvbm5lY3Rpb24nIH0pLCBzZXJ2ZXIsIHRoaXMpO1xuICAgICAgICBzZXJ2ZXIuZGlzcGF0Y2hFdmVudChjcmVhdGVFdmVudCh7IHR5cGU6ICdjb25uZWN0JyB9KSwgc2VydmVyLCB0aGlzKTsgLy8gYWxpYXNcbiAgICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KGNyZWF0ZUV2ZW50KHsgdHlwZTogJ2Nvbm5lY3QnLCB0YXJnZXQ6IHRoaXMgfSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5yZWFkeVN0YXRlID0gU29ja2V0SU8uQ0xPU0VEO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoY3JlYXRlRXZlbnQoeyB0eXBlOiAnZXJyb3InLCB0YXJnZXQ6IHRoaXMgfSkpO1xuICAgICAgICB0aGlzLmRpc3BhdGNoRXZlbnQoXG4gICAgICAgICAgY3JlYXRlQ2xvc2VFdmVudCh7XG4gICAgICAgICAgICB0eXBlOiAnY2xvc2UnLFxuICAgICAgICAgICAgdGFyZ2V0OiB0aGlzLFxuICAgICAgICAgICAgY29kZTogQ0xPU0VfQ09ERVMuQ0xPU0VfTk9STUFMXG4gICAgICAgICAgfSlcbiAgICAgICAgKTtcblxuICAgICAgICBsb2dnZXIoJ2Vycm9yJywgYFNvY2tldC5pbyBjb25uZWN0aW9uIHRvICcke3RoaXMudXJsfScgZmFpbGVkYCk7XG4gICAgICB9XG4gICAgfSwgdGhpcyk7XG5cbiAgICAvKipcbiAgICAgIEFkZCBhbiBhbGlhc2VkIGV2ZW50IGxpc3RlbmVyIGZvciBjbG9zZSAvIGRpc2Nvbm5lY3RcbiAgICAgKi9cbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2Nsb3NlJywgZXZlbnQgPT4ge1xuICAgICAgdGhpcy5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBjcmVhdGVDbG9zZUV2ZW50KHtcbiAgICAgICAgICB0eXBlOiAnZGlzY29ubmVjdCcsXG4gICAgICAgICAgdGFyZ2V0OiBldmVudC50YXJnZXQsXG4gICAgICAgICAgY29kZTogZXZlbnQuY29kZVxuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qXG4gICAqIENsb3NlcyB0aGUgU29ja2V0SU8gY29ubmVjdGlvbiBvciBjb25uZWN0aW9uIGF0dGVtcHQsIGlmIGFueS5cbiAgICogSWYgdGhlIGNvbm5lY3Rpb24gaXMgYWxyZWFkeSBDTE9TRUQsIHRoaXMgbWV0aG9kIGRvZXMgbm90aGluZy5cbiAgICovXG4gIGNsb3NlKCkge1xuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgIT09IFNvY2tldElPLk9QRU4pIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgY29uc3Qgc2VydmVyID0gbmV0d29ya0JyaWRnZS5zZXJ2ZXJMb29rdXAodGhpcy51cmwpO1xuICAgIG5ldHdvcmtCcmlkZ2UucmVtb3ZlV2ViU29ja2V0KHRoaXMsIHRoaXMudXJsKTtcblxuICAgIHRoaXMucmVhZHlTdGF0ZSA9IFNvY2tldElPLkNMT1NFRDtcbiAgICB0aGlzLmRpc3BhdGNoRXZlbnQoXG4gICAgICBjcmVhdGVDbG9zZUV2ZW50KHtcbiAgICAgICAgdHlwZTogJ2Nsb3NlJyxcbiAgICAgICAgdGFyZ2V0OiB0aGlzLFxuICAgICAgICBjb2RlOiBDTE9TRV9DT0RFUy5DTE9TRV9OT1JNQUxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGlmIChzZXJ2ZXIpIHtcbiAgICAgIHNlcnZlci5kaXNwYXRjaEV2ZW50KFxuICAgICAgICBjcmVhdGVDbG9zZUV2ZW50KHtcbiAgICAgICAgICB0eXBlOiAnZGlzY29ubmVjdCcsXG4gICAgICAgICAgdGFyZ2V0OiB0aGlzLFxuICAgICAgICAgIGNvZGU6IENMT1NFX0NPREVTLkNMT1NFX05PUk1BTFxuICAgICAgICB9KSxcbiAgICAgICAgc2VydmVyXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLypcbiAgICogQWxpYXMgZm9yIFNvY2tldCNjbG9zZVxuICAgKlxuICAgKiBodHRwczovL2dpdGh1Yi5jb20vc29ja2V0aW8vc29ja2V0LmlvLWNsaWVudC9ibG9iL21hc3Rlci9saWIvc29ja2V0LmpzI0wzODNcbiAgICovXG4gIGRpc2Nvbm5lY3QoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xvc2UoKTtcbiAgfVxuXG4gIC8qXG4gICAqIFN1Ym1pdHMgYW4gZXZlbnQgdG8gdGhlIHNlcnZlciB3aXRoIGEgcGF5bG9hZFxuICAgKi9cbiAgZW1pdChldmVudCwgLi4uZGF0YSkge1xuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgIT09IFNvY2tldElPLk9QRU4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU29ja2V0SU8gaXMgYWxyZWFkeSBpbiBDTE9TSU5HIG9yIENMT1NFRCBzdGF0ZScpO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc3NhZ2VFdmVudCA9IGNyZWF0ZU1lc3NhZ2VFdmVudCh7XG4gICAgICB0eXBlOiBldmVudCxcbiAgICAgIG9yaWdpbjogdGhpcy51cmwsXG4gICAgICBkYXRhXG4gICAgfSk7XG5cbiAgICBjb25zdCBzZXJ2ZXIgPSBuZXR3b3JrQnJpZGdlLnNlcnZlckxvb2t1cCh0aGlzLnVybCk7XG5cbiAgICBpZiAoc2VydmVyKSB7XG4gICAgICBzZXJ2ZXIuZGlzcGF0Y2hFdmVudChtZXNzYWdlRXZlbnQsIC4uLmRhdGEpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLypcbiAgICogU3VibWl0cyBhICdtZXNzYWdlJyBldmVudCB0byB0aGUgc2VydmVyLlxuICAgKlxuICAgKiBTaG91bGQgYmVoYXZlIGV4YWN0bHkgbGlrZSBXZWJTb2NrZXQjc2VuZFxuICAgKlxuICAgKiBodHRwczovL2dpdGh1Yi5jb20vc29ja2V0aW8vc29ja2V0LmlvLWNsaWVudC9ibG9iL21hc3Rlci9saWIvc29ja2V0LmpzI0wxMTNcbiAgICovXG4gIHNlbmQoZGF0YSkge1xuICAgIHRoaXMuZW1pdCgnbWVzc2FnZScsIGRhdGEpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLypcbiAgICogRm9yIGJyb2FkY2FzdGluZyBldmVudHMgdG8gb3RoZXIgY29ubmVjdGVkIHNvY2tldHMuXG4gICAqXG4gICAqIGUuZy4gc29ja2V0LmJyb2FkY2FzdC5lbWl0KCdoaSEnKTtcbiAgICogZS5nLiBzb2NrZXQuYnJvYWRjYXN0LnRvKCdteS1yb29tJykuZW1pdCgnaGkhJyk7XG4gICAqL1xuICBnZXQgYnJvYWRjYXN0KCkge1xuICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgIT09IFNvY2tldElPLk9QRU4pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignU29ja2V0SU8gaXMgYWxyZWFkeSBpbiBDTE9TSU5HIG9yIENMT1NFRCBzdGF0ZScpO1xuICAgIH1cblxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHNlcnZlciA9IG5ldHdvcmtCcmlkZ2Uuc2VydmVyTG9va3VwKHRoaXMudXJsKTtcbiAgICBpZiAoIXNlcnZlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBTb2NrZXRJTyBjYW4gbm90IGZpbmQgYSBzZXJ2ZXIgYXQgdGhlIHNwZWNpZmllZCBVUkwgKCR7dGhpcy51cmx9KWApO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBlbWl0KGV2ZW50LCBkYXRhKSB7XG4gICAgICAgIHNlcnZlci5lbWl0KGV2ZW50LCBkYXRhLCB7IHdlYnNvY2tldHM6IG5ldHdvcmtCcmlkZ2Uud2Vic29ja2V0c0xvb2t1cChzZWxmLnVybCwgbnVsbCwgc2VsZikgfSk7XG4gICAgICAgIHJldHVybiBzZWxmO1xuICAgICAgfSxcbiAgICAgIHRvKHJvb20pIHtcbiAgICAgICAgcmV0dXJuIHNlcnZlci50byhyb29tLCBzZWxmKTtcbiAgICAgIH0sXG4gICAgICBpbihyb29tKSB7XG4gICAgICAgIHJldHVybiBzZXJ2ZXIuaW4ocm9vbSwgc2VsZik7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIC8qXG4gICAqIEZvciByZWdpc3RlcmluZyBldmVudHMgdG8gYmUgcmVjZWl2ZWQgZnJvbSB0aGUgc2VydmVyXG4gICAqL1xuICBvbih0eXBlLCBjYWxsYmFjaykge1xuICAgIHRoaXMuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBjYWxsYmFjayk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKlxuICAgKiBSZW1vdmUgZXZlbnQgbGlzdGVuZXJcbiAgICpcbiAgICogaHR0cHM6Ly9zb2NrZXQuaW8vZG9jcy9jbGllbnQtYXBpLyNzb2NrZXQtb24tZXZlbnRuYW1lLWNhbGxiYWNrXG4gICAqL1xuICBvZmYodHlwZSkge1xuICAgIHRoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlKTtcbiAgfVxuXG4gIC8qXG4gICAqIEpvaW4gYSByb29tIG9uIGEgc2VydmVyXG4gICAqXG4gICAqIGh0dHA6Ly9zb2NrZXQuaW8vZG9jcy9yb29tcy1hbmQtbmFtZXNwYWNlcy8jam9pbmluZy1hbmQtbGVhdmluZ1xuICAgKi9cbiAgam9pbihyb29tKSB7XG4gICAgbmV0d29ya0JyaWRnZS5hZGRNZW1iZXJzaGlwVG9Sb29tKHRoaXMsIHJvb20pO1xuICB9XG5cbiAgLypcbiAgICogR2V0IHRoZSB3ZWJzb2NrZXQgdG8gbGVhdmUgdGhlIHJvb21cbiAgICpcbiAgICogaHR0cDovL3NvY2tldC5pby9kb2NzL3Jvb21zLWFuZC1uYW1lc3BhY2VzLyNqb2luaW5nLWFuZC1sZWF2aW5nXG4gICAqL1xuICBsZWF2ZShyb29tKSB7XG4gICAgbmV0d29ya0JyaWRnZS5yZW1vdmVNZW1iZXJzaGlwRnJvbVJvb20odGhpcywgcm9vbSk7XG4gIH1cblxuICB0byhyb29tKSB7XG4gICAgcmV0dXJuIHRoaXMuYnJvYWRjYXN0LnRvKHJvb20pO1xuICB9XG5cbiAgaW4oKSB7XG4gICAgcmV0dXJuIHRoaXMudG8uYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgfVxuXG4gIC8qXG4gICAqIEludm9rZXMgYWxsIGxpc3RlbmVyIGZ1bmN0aW9ucyB0aGF0IGFyZSBsaXN0ZW5pbmcgdG8gdGhlIGdpdmVuIGV2ZW50LnR5cGUgcHJvcGVydHkuIEVhY2hcbiAgICogbGlzdGVuZXIgd2lsbCBiZSBwYXNzZWQgdGhlIGV2ZW50IGFzIHRoZSBmaXJzdCBhcmd1bWVudC5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IGV2ZW50IC0gZXZlbnQgb2JqZWN0IHdoaWNoIHdpbGwgYmUgcGFzc2VkIHRvIGFsbCBsaXN0ZW5lcnMgb2YgdGhlIGV2ZW50LnR5cGUgcHJvcGVydHlcbiAgICovXG4gIGRpc3BhdGNoRXZlbnQoZXZlbnQsIC4uLmN1c3RvbUFyZ3VtZW50cykge1xuICAgIGNvbnN0IGV2ZW50TmFtZSA9IGV2ZW50LnR5cGU7XG4gICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnNbZXZlbnROYW1lXTtcblxuICAgIGlmICghQXJyYXkuaXNBcnJheShsaXN0ZW5lcnMpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbGlzdGVuZXJzLmZvckVhY2gobGlzdGVuZXIgPT4ge1xuICAgICAgaWYgKGN1c3RvbUFyZ3VtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGN1c3RvbUFyZ3VtZW50cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBSZWd1bGFyIFdlYlNvY2tldHMgZXhwZWN0IGEgTWVzc2FnZUV2ZW50IGJ1dCBTb2NrZXRpby5pbyBqdXN0IHdhbnRzIHJhdyBkYXRhXG4gICAgICAgIC8vICBwYXlsb2FkIGluc3RhbmNlb2YgTWVzc2FnZUV2ZW50IHdvcmtzLCBidXQgeW91IGNhbid0IGlzbnRhbmNlIG9mIE5vZGVFdmVudFxuICAgICAgICAvLyAgZm9yIG5vdyB3ZSBkZXRlY3QgaWYgdGhlIG91dHB1dCBoYXMgZGF0YSBkZWZpbmVkIG9uIGl0XG4gICAgICAgIGxpc3RlbmVyLmNhbGwodGhpcywgZXZlbnQuZGF0YSA/IGV2ZW50LmRhdGEgOiBldmVudCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuU29ja2V0SU8uQ09OTkVDVElORyA9IDA7XG5Tb2NrZXRJTy5PUEVOID0gMTtcblNvY2tldElPLkNMT1NJTkcgPSAyO1xuU29ja2V0SU8uQ0xPU0VEID0gMztcblxuLypcbiAqIFN0YXRpYyBjb25zdHJ1Y3RvciBtZXRob2RzIGZvciB0aGUgSU8gU29ja2V0XG4gKi9cbmNvbnN0IElPID0gZnVuY3Rpb24gaW9Db25zdHJ1Y3Rvcih1cmwsIHByb3RvY29sKSB7XG4gIHJldHVybiBuZXcgU29ja2V0SU8odXJsLCBwcm90b2NvbCk7XG59O1xuXG4vKlxuICogQWxpYXMgdGhlIHJhdyBJTygpIGNvbnN0cnVjdG9yXG4gKi9cbklPLmNvbm5lY3QgPSBmdW5jdGlvbiBpb0Nvbm5lY3QodXJsLCBwcm90b2NvbCkge1xuICAvKiBlc2xpbnQtZGlzYWJsZSBuZXctY2FwICovXG4gIHJldHVybiBJTyh1cmwsIHByb3RvY29sKTtcbiAgLyogZXNsaW50LWVuYWJsZSBuZXctY2FwICovXG59O1xuXG5leHBvcnQgZGVmYXVsdCBJTztcbiIsImltcG9ydCBNb2NrU2VydmVyIGZyb20gJy4vc2VydmVyJztcbmltcG9ydCBNb2NrU29ja2V0SU8gZnJvbSAnLi9zb2NrZXQtaW8nO1xuaW1wb3J0IE1vY2tXZWJTb2NrZXQgZnJvbSAnLi93ZWJzb2NrZXQnO1xuXG5leHBvcnQgY29uc3QgU2VydmVyID0gTW9ja1NlcnZlcjtcbmV4cG9ydCBjb25zdCBXZWJTb2NrZXQgPSBNb2NrV2ViU29ja2V0O1xuZXhwb3J0IGNvbnN0IFNvY2tldElPID0gTW9ja1NvY2tldElPO1xuIl0sIm5hbWVzIjpbImdsb2JhbCIsInFzIiwicmVxdWlyZWQiLCJjb25zdCIsInRoaXMiLCJzdXBlciIsIldlYlNvY2tldCIsIlVSTCIsImxvZ2dlciIsIlNlcnZlciIsImdsb2JhbE9iamVjdCIsIlNvY2tldElPIiwiTW9ja1NlcnZlciIsIk1vY2tXZWJTb2NrZXQiLCJNb2NrU29ja2V0SU8iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQVdBLGdCQUFjLEdBQUcsU0FBUyxRQUFRLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtFQUNqRCxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNsQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUM7O0VBRWIsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFBLE9BQU8sS0FBSyxDQUFDLEVBQUE7O0VBRXhCLFFBQVEsUUFBUTtJQUNkLEtBQUssTUFBTSxDQUFDO0lBQ1osS0FBSyxJQUFJO0lBQ1QsT0FBTyxJQUFJLEtBQUssRUFBRSxDQUFDOztJQUVuQixLQUFLLE9BQU8sQ0FBQztJQUNiLEtBQUssS0FBSztJQUNWLE9BQU8sSUFBSSxLQUFLLEdBQUcsQ0FBQzs7SUFFcEIsS0FBSyxLQUFLO0lBQ1YsT0FBTyxJQUFJLEtBQUssRUFBRSxDQUFDOztJQUVuQixLQUFLLFFBQVE7SUFDYixPQUFPLElBQUksS0FBSyxFQUFFLENBQUM7O0lBRW5CLEtBQUssTUFBTTtJQUNYLE9BQU8sS0FBSyxDQUFDO0dBQ2Q7O0VBRUQsT0FBTyxJQUFJLEtBQUssQ0FBQyxDQUFDO0NBQ25CLENBQUM7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
