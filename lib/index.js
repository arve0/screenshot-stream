/* global phantom */
'use strict';

var system = require('system');
var page = require('webpage').create();
var assign = require('object-assign');
var opts = JSON.parse(system.args[1]);
var log = console.log;

function formatTrace(trace) {
	var src = trace.file || trace.sourceURL;
	var fn = (trace.function ? ' in function ' + trace.function : '');
	return '→ ' + src + ' on line ' + trace.line + fn;
}

console.log = console.error = function () {
	system.stderr.writeLine([].slice.call(arguments).join(' '));
};

if (opts.username && opts.password) {
	opts.customHeaders = assign({}, opts.customHeaders, {
		'Authorization': 'Basic ' + btoa(opts.username + ':' + opts.password)
	});
}

opts.cookies.forEach(function (cookie) {
	if (!phantom.addCookie(cookie)) {
		console.error('Couldn\'t add cookie: ' + cookie);
		phantom.exit(1);
	}
});

phantom.onError = function (err, trace) {
	console.error([
		'PHANTOM ERROR: ' + err,
		formatTrace(trace[0])
	].join('\n'));

	phantom.exit(1);
};

page.onError = function (err, trace) {
	console.error([
		'WARN: ' + err,
		formatTrace(trace[0])
	].join('\n'));
};

page.onResourceReceived = function () {
	page.injectJs(opts.es5shim);
};

page.viewportSize = {
	width: opts.width,
	height: opts.height
};

page.customHeaders = opts.customHeaders || {};
page.zoomFactor = opts.scale;

page.open(opts.url, function (status) {
	if (status === 'fail') {
		console.error('Couldn\'t load url: ' + opts.url);
		phantom.exit(1);
		return;
	}

	if (opts.crop) {
		page.clipRect = {
			top: 0,
			left: 0,
			width: opts.width,
			height: opts.height
		};
	}

	page.evaluate(function () {
		var bgColor = window
			.getComputedStyle(document.body)
			.getPropertyValue('background-color');

		if (!bgColor || bgColor === 'rgba(0, 0, 0, 0)') {
			document.body.style.backgroundColor = 'white';
		}
	});

	window.setTimeout(function () {
		if (opts.hide) {
			page.evaluate(function (els) {
				els.forEach(function (el) {
					[].forEach.call(document.querySelectorAll(el), function (e) {
						e.style.visibility = 'hidden';
					});
				});
			}, opts.hide);
		}

		if (opts.selector) {
			page.clipRect = page.evaluate(function (el) {
				return document
					.querySelector(el)
					.getBoundingClientRect();
			}, opts.selector);
		}

		log.call(console, page.renderBase64(opts.format));
		phantom.exit();
	}, opts.delay * 1000);
});
