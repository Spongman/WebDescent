/// <reference path="DataView.ts" />
/// <reference path="DataStream.ts" />

/// <reference path="Math.ts" />
/// <reference path="webgl.ts" />
"use strict";

let _pig: Pig;

enum BitmapFlags {
	TRANSPARENT = (1 << 0),
	SUPER_TRANSPARENT = (1 << 1),
	NO_LIGHTING = (1 << 2),
	RLE = (1 << 3),  // A run-length encoded bitmap.
	PAGED_OUT = (1 << 4),  // This bitmap's data is paged out.
	RLE_BIG = (1 << 5),  // for bitmaps that RLE to > 255 per row (i.e. cockpits)
}
class BitmapHeader {
	buffer: ArrayBuffer;
	name: string;
	// dflags: number;
	width: number;
	height: number;
	// wh_extra: number;
	flags: BitmapFlags;
	avg_color: number;
	offset: number;

	data: Uint8Array;

	load(stream: DataStream) {
		this.buffer = stream.view.buffer;
		this.name = stream.getTerminatedString(["\0", "\n"], 8);
		const dflags = stream.getUint8();
		this.width = stream.getUint8();
		this.height = stream.getUint8();
		const wh_extra = stream.getUint8();
		this.flags = stream.getUint8();
		this.avg_color = stream.getUint8();
		this.offset = stream.getUint32();

		if (dflags & (1 << 6)) {
			this.name += "#" + (dflags & ((1 << 6) - 1));
		}

		this.width += (wh_extra & 0x0f) << 8;
		this.height += (wh_extra & 0xf0) << 4;

		return this;
	}
	isTransparent() {
		return this.flags & BitmapFlags.TRANSPARENT;
	}
	loadImage() {
		if (!this.data) {
			const view = new DataView(this.buffer, this.offset);
			const stream = new DataStream(view);
			if (this.flags & BitmapFlags.RLE) {
				const cbTotal = stream.getUint32();
				const offset = stream.position;

				let rgSizes: number[];
				if (this.flags & BitmapFlags.RLE_BIG) {
					rgSizes = stream.getUint16Array(this.height);
				} else {
					rgSizes = stream.getUint8Array(this.height);
				}

				const offsetData = stream.position;
				let cbData = 0;

				const rgPixels: number[] = [];

				for (let y = 0; y < this.height; ++y) {
					if (rgPixels.length !== this.width * y) {
						throw new Error("corrupt image data");
					}

					for (let data = stream.getUint8(); data !== 0xe0; data = stream.getUint8()) {
						if ((data & 0xe0) === 0xe0) {
							let count = data & ~0xe0;
							data = stream.getUint8();
							while (count--) {
								rgPixels.push(data);
							}
						} else {
							rgPixels.push(data);
						}
					}

					cbData += rgSizes[y];

					if (offsetData + cbData !== stream.position) {
						throw new Error("corrupt image data");
					}
				}

				if (rgPixels.length !== this.width * this.height) {
					throw new Error("missing pixels");
				}

				this.data = new Uint8Array(rgPixels);
			} else {
				this.data = new Uint8Array(stream.view.buffer, stream.view.byteOffset + stream.position, this.width * this.height);
			}
		}

		return this.data;
	}
	getPixel(x: number, y: number) {
		x = Math.mod(x, this.width);
		y = Math.mod(y, this.height);

		const data = this.loadImage();
		return this.data[x + y * this.width];
	}
}
class Texture {
	constructor(
		public tex: WebGLTexture,
		public bmp: BitmapHeader) {
			// do nothing
	}
}

enum TMapInfoFlags {
	VOLATILE = (1 << 0),	  // this material blows up when hit
	WATER = (1 << 1),	  // this material is water
	FORCE_FIELD = (1 << 2),	  // this is force field - flares don't stick
	GOAL_BLUE = (1 << 3),	  // this is used to remap the blue goal
	GOAL_RED = (1 << 4),	  // this is used to remap the red goal
	GOAL_HOARD = (1 << 5),	  // this is used to remap the goals
}
class TMapInfo {
	flags: TMapInfoFlags;
	lighting: number;
	damage: number;
	eclip_num: number;
	destroyed: number;
	slide_u: number;
	slide_v: number;

	textureIndex: number;

	load(stream: DataStream) {
		this.flags = stream.getUint8();
		stream.position += 3;
		this.lighting = stream.getFixed();
		this.damage = stream.getFixed();
		this.eclip_num = stream.getInt16();
		this.destroyed = stream.getInt16();
		this.slide_u = stream.getFixed2();
		this.slide_v = stream.getFixed2();

		return this;
	}
	loadTexture(iUnit: number): Texture {
		return _pig.loadBitmap(this.textureIndex, iUnit);
	}
	getBitmapAsset() {
		return _pig.getAsset(this.textureIndex);
	}
	isTransparent() {
		const asset = this.getBitmapAsset();
		return asset.isTransparent();
	}
	getPixel(u: number, v: number): number {
		const bmp = this.getBitmapAsset();
		return bmp.getPixel(Math.floor(u * bmp.width), Math.floor(v * bmp.height));
	}
}
function isPowerOf2(x: number) { return 0 === (x & (x - 1)); }

class Pig {
	assets: BitmapHeader[];
	// mapAssetByName: object;
	rgLoadedTextures: Texture[] = [];

	load(view: DataView) {
		const pig = new DataStream(view);

		const id = pig.getString(4);
		const version = pig.getUint32();

		if (id !== "PPIG" || version !== 2) {
			throw new Error("invalid PIG version: " + id + "/" + version);
		}

		const cBitmaps = pig.getUint32();

		const rgBitmaps = Array_iterate(cBitmaps, () => new BitmapHeader().load(pig));

		const dataStart = pig.position;

		const mapAssetsByName: { [index: string]: any } = {};

		for (let iBitmap = 0; iBitmap < cBitmaps; ++iBitmap) {
			const bitmap = rgBitmaps[iBitmap];
			mapAssetsByName[bitmap.name] = bitmap;
			bitmap.offset += dataStart;
		}

		this.assets = rgBitmaps;
		// this.mapAssetsByName = mapAssetsByName;

		return this;
	}
	getAsset(index: number) {
		index--;
		if (index < 0 || index >= this.assets.length) {
			throw new Error("bitmap index out of range: " + index);
		}

		return this.assets[index];
	}

	loadBitmap(iBitmap: number, iUnit: number): Texture {
		if (iBitmap === 0) {
			throw new Error("missing bitmap" + iBitmap);
		}

		let texture = this.rgLoadedTextures[iBitmap];
		if (!texture) {
			const bmp = this.getAsset(iBitmap);

			const tex = createTexture(iUnit);

			texture = this.rgLoadedTextures[iBitmap] = new Texture(tex, bmp);

			if (isPowerOf2(bmp.width) && isPowerOf2(bmp.height)) {
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
			} else {
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			}

			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, bmp.width, bmp.height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bmp.loadImage());
			// gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, bmp.width, bmp.height, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
		}
		return texture;
	}
}
