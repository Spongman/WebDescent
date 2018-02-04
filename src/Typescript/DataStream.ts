/// <areference path="DataView.ts" />
"use strict";

if (typeof ArrayBuffer === "undefined") {
	throw new Error("ArrayBuffer not supported");
}

if (typeof DataView === "undefined") {
	throw new Error("DataView not supported");
}

if (typeof Object.defineProperties === "undefined") {
	throw new Error("This module requires ECMAScript 5");
}

class DataStream {
	position = 0;

	littleEndian = false;
	view: any;
	byteLength: any;

	constructor(view: ArrayBuffer|DataView, littleEndian?: boolean);

	// The DataStream() constructor
	constructor(view: any, littleEndian = true) {
		if (view instanceof ArrayBuffer) {
			view = new DataView(view);
		} else if (!(view instanceof DataView)) {
			throw new Error("Bad DataView");
							}

		Object.defineProperties(this, {
			view: {
				value: view,
				enumerable: false, writable: false, configurable: false,
			},
			byteLength: {
				value: view.byteLength,
				enumerable: false, writable: false, configurable: false,
			},
			littleEndian: {
				value: !!littleEndian,
				enumerable: false, writable: false, configurable: false,
			},
		});
	}
	getInt8(): number {
		const value = this.view.getInt8(this.position);
		this.position++;
		return value;
	}
	getUint8(): number {
		const value = this.view.getUint8(this.position);
		this.position++;
		return value;
	}
	getInt16(): number {
		const value = this.view.getInt16(this.position, this.littleEndian);
		this.position += 2;
		return value;
	}
	getUint16(): number {
		const value = this.view.getUint16(this.position, this.littleEndian);
		this.position += 2;
		return value;
	}
	getInt32(): number {
		const value = this.view.getInt32(this.position, this.littleEndian);
		this.position += 4;
		return value;
	}
	getUint32(): number {
		const value = this.view.getUint32(this.position, this.littleEndian);
		this.position += 4;
		return value;
	}
	getFloat32(): number {
		const value = this.view.getFloat32(this.position, this.littleEndian);
		this.position += 4;
		return value;
	}
	getFloat64(): number {
		const value = this.view.getFloat64(this.position, this.littleEndian);
		this.position += 8;
		return value;
	}
	getString(length: number): string {
		if (typeof length !== "number") {
			throw new Error("bad type for length: " + typeof length);
		}

		if (length < 0 || this.position + length > this.byteLength) {
			throw new Error("INDEX_SIZE_ERR: DOM Exception 1");
		}

		let value = "";
		for (let i = 0; i < length; ++i) {
			let b = this.getUint8();
			if (b > 127) {
				b = 0xfffd;
			}
			value += String.fromCharCode(b);
		}
		return value;
	}
	getTerminatedString(terminators: string[], length?: number): string {
		let value = "";
		const start = this.position;
		while (true) {
			if (length && value.length >= length) {
				break;
			}

			let b = this.getUint8();
			if (b > 127) {
				b = 0xfffd;
			}

			const ch = String.fromCharCode(b);
			if (terminators.indexOf(ch) >= 0) {
				break;
			}

			value += ch;
		}
		if (length) {
			this.position = start + length;
		}
		return value;
	}
	getFixed() {
		return fix(this.getInt32());
	}
	getFixed2() {
		return fix2(this.getInt16());
	}
	getVector() {
		const x = this.getFixed();
		const y = this.getFixed();
		const z = this.getFixed();

		if (x === 0 && y === 0 && z === 0) {
			return Vec3.Zero;
		}

		return new Vec3(x, y, z);
	}
	getVector2() {
		const x = this.getFixed2();
		const y = this.getFixed2();
		const z = this.getFixed2();

		if (x === 0 && y === 0 && z === 0) {
			return Vec3.Zero;
		}

		return new Vec3(x, y, z);
	}
	getMatrix() {
		return new Mat3(
			this.getVector(),
			this.getVector(),
			this.getVector(),
		);
	}
	getRGB(): number {
		const r = this.getUint8();
		const g = this.getUint8();
		const b = this.getUint8();

		return (r << 16) | (g << 8) | b;
	}
	getColor15() {
		const rgb = this.getUint16();

		const r = ((rgb >> 10) & 31) / 31;
		const g = ((rgb >> 5) & 31) / 31;
		const b = (rgb & 31) / 31;

		return new Vec3(r, g, b);
	}
	getInt8Array(count: number): number[] { return Array_iterate(count, this.getInt8.bind(this) as (i: number) => any); }
	getInt16Array(count: number): number[] { return Array_iterate(count, this.getInt16.bind(this) as (i: number) => any); }
	getInt32Array(count: number): number[] { return Array_iterate(count, this.getInt32.bind(this) as (i: number) => any); }

	getUint8Array(count: number): number[] { return Array_iterate(count, this.getUint8.bind(this) as (i: number) => any); }
	getUint16Array(count: number): number[] { return Array_iterate(count, this.getUint16.bind(this) as (i: number) => any); }
	getUint32Array(count: number): number[] { return Array_iterate(count, this.getUint32.bind(this) as (i: number) => any); }

	getVectorArray(count: number): Vec3[] { return Array_iterate(count, this.getVector.bind(this) as (i: number) => any); }
	getVector2Array(count: number): Vec3[] { return Array_iterate(count, this.getVector2.bind(this) as (i: number) => any); }
	getRGBArray(count: number): number[] { return Array_iterate(count, this.getRGB.bind(this) as (i: number) => any); }
	getFixedArray(count: number): number[] { return Array_iterate(count, this.getFixed.bind(this) as (i: number) => any); }
}
interface DataView {
	getVector(): Vec3;
	slice(offset: number, length: number): DataView;
}

interface DataStream {
	[index: string]: any;
}

DataView.prototype.slice = function (offset: number, length: number) {
	if (!(offset >= 0 && offset + length <= this.byteLength)) {
		throw new Error("Invalid index: " + offset);
	}
	return new DataView(this.buffer, this.byteOffset + offset, length);
};
