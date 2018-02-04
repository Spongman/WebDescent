/// <reference path="DataView.ts" />
/// <reference path="DataStream.ts" />

/// <reference path="Math.ts" />
/// <reference path="webgl.ts" />

"use strict";

let _hog: Hog;

class HogEntry {
	constructor(public name: string, public view: DataView) {
	}
}
class Hog {
	private _mapEntries: { [index: string]: HogEntry };

	load(view: DataView) {
		const stream = new DataStream(view);

		const magic = stream.getString(3);
		if (magic !== "DHF") {
			throw new Error("invalid HOG file signature");
		}

		const mapEntries: { [index: string]: HogEntry } = {};

		while (stream.position < stream.byteLength) {
			const strFilename = stream.getTerminatedString(["\0", "\n"], 13);
			const cbFile = stream.getInt32();
			const ibFile = stream.position;

			mapEntries[strFilename.toLowerCase()] = new HogEntry(strFilename, stream.view.slice(ibFile, cbFile));

			stream.position = ibFile + cbFile;
		}

		this._mapEntries = mapEntries;

		return this;
	}
	getEntry(name: string): HogEntry {
		return this._mapEntries[name.toLowerCase()];
	}
}
