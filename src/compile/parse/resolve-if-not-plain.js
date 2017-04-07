// https://raw.githubusercontent.com/ModuleLoader/es-module-loader/2e44cef516c9317d19c072e18e016649a3c4d4b6/core/resolve.js

const throwResolveError = (href, parentHref) => {
	throw new RangeError(`Unable to resolve ${href} to ${parentHref}`)
}
const isProtocolRelative = (href) => {
	return href.slice(0, 2) === "//"
}
const isPathRelative = (href) => {
	// basically it means '/' or './' or '../'
	const firstChar = href[0]
	if (firstChar === "/") {
		return true
	}
	if (firstChar === ".") {
		if (href.length === 1) {
			return true
		}
		const secondChar = href[1]
		if (secondChar === "/") {
			return true
		}
		if (secondChar === ".") {
			if (href.length === 2) {
				return true
			}
			const thirdChar = href[2]
			return thirdChar === "/"
		}
	}
	return false
}
const resolveIfNotPlain = (href, parentHref) => {
	href = href.trim()
	const parentProtocol = parentHref && parentHref.substr(0, parentHref.indexOf(":") + 1)

	if (isProtocolRelative(href)) {
		if (!parentProtocol) {
			throwResolveError(href, parentHref)
		}
		return parentProtocol + href
	}
	if (isPathRelative(href)) {
		const parentIsPlain = !parentProtocol || parentHref[parentProtocol.length] !== "/"

		// read pathname from parent if a URL
		// pathname taken to be part after leading "/"
		var pathname
		if (parentIsPlain) {
			// resolving to a plain parent -> skip standard URL prefix, and treat entire parent as pathname
			if (parentHref === undefined) {
				throwResolveError(href, parentHref)
			}
			pathname = href
		}
		else if (parentHref[parentProtocol.length + 1] === "/") {
			// resolving to a :// so we need to read out the auth and host
			if (parentProtocol === "file:") {
				pathname = parentHref.substr(8)
			}
			else {
				pathname = parentHref.substr(parentProtocol.length + 2)
				pathname = pathname.substr(pathname.indexOf("/") + 1)
			}
		}
		else {
			// resolving to :/ so pathname is the /... part
			pathname = parentHref.substr(parentProtocol.length + 1)
		}

		if (href[0] === "/") {
			if (parentIsPlain) {
				throwResolveError(href, parentHref)
			}
			else {
				return parentHref.substr(0, parentHref.length - pathname.length - 1) + href
			}
		}

		// join together and split for removal of .. and . segments
		// looping the string instead of anything fancy for perf reasons
		// '../../../../../z' resolved to 'x/y' is just 'z' regardless of parentIsPlain
		const segmented = pathname.substr(0, pathname.lastIndexOf("/") + 1) + href
		const output = []
		var segmentIndex

		for (var i = 0; i < segmented.length; i++) {
			// busy reading a segment - only terminate on '/'
			if (segmentIndex !== undefined) {
				if (segmented[i] === "/") {
					output.push(segmented.substr(segmentIndex, i - segmentIndex + 1))
					segmentIndex = undefined
				}
				continue
			}

			// new segment - check if it is relative
			if (segmented[i] === ".") {
				// ../ segment
				if (segmented[i + 1] === "." && (segmented[i + 2] === "/" || i === segmented.length - 2)) {
					output.pop()
					i += 2
				}
				// ./ segment
				else if (segmented[i + 1] === "/" || i === segmented.length - 1) {
					i += 1
				}
				else {
					// the start of a new segment as below
					segmentIndex = i
					continue
				}

				// this is the plain URI backtracking error (../, package:x -> error)
				if (parentIsPlain && output.length === 0) {
					throwResolveError(href, parentHref)
				}

				// trailing . or .. segment
				if (i === segmented.length) {
					output.push("")
				}
				continue
			}
			// it is the start of a new segment
			segmentIndex = i
		}
		// finish reading out the last segment
		if (segmentIndex !== undefined) {
			output.push(segmented.substr(segmentIndex, segmented.length - segmentIndex))
		}

		return parentHref.substr(0, parentHref.length - pathname.length) + output.join("")
	}

	// sanitizes and verifies (by returning undefined if not a valid URL-like form)
	// Windows filepath compatibility is an added convenience here
	const protocolIndex = href.indexOf(":")
	if (protocolIndex !== -1) {
		if (typeof process !== "undefined") {
			// C:\x becomes file:///c:/x (we don't support C|\x)
			if (href[1] === ":" && href[2] === "\\" && href[0].match(/[a-z]/i)) {
				return `file:///"${href.replace(/\\/g, "/")}`
			}
		}
		return href
	}
}

module.exports = resolveIfNotPlain
