/* 
 * DataView.js:
 * An implementation of the DataView class on top of typed arrays.
 * Useful for Firefox 4 which implements TypedArrays but not DataView.
 *
 * Copyright 2011, David Flanagan
 *
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, 
 * are permitted provided that the following conditions are met:
 *
 *   Redistributions of source code must retain the above copyright notice, 
 *   this list of conditions and the following disclaimer.
 *
 *   Redistributions in binary form must reproduce the above copyright notice, 
 *   this list of conditions and the following disclaimer in the documentation.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" 
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE 
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE 
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE 
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR 
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE 
 * GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) 
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT 
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT 
 * OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
"use strict";

module DataView_
{
	// If DataView already exists, do nothing
	//if (DataView)
	//	return;

	// If ArrayBuffer is not supported, fail with an error
	if (!ArrayBuffer)
		throw new Error("ArrayBuffer not supported");

	// If ES5 is not supported, fail
	if (!Object.defineProperties)
		throw new Error("This module requires ECMAScript 5");

	// A temporary array for copying or reversing bytes into.
	// Since js is single-threaded, we only need this one static copy

	// The DataView() constructor
	class DataView
	{
		// Figure if the platform is natively little-endian.
		// If the integer 0x00000001 is arranged in memory as 01 00 00 00 then
		// we're on a little endian platform. On a big-endian platform we'd get
		// get bytes 00 00 00 01 instead.
		static nativele: boolean = new Int8Array(new Int32Array([1]).buffer)[0] === 1;

		static temp = new Uint8Array(8);

		buffer: ArrayBuffer;
		byteOffset: number;
		byteLength: number;

		_typedViews: { [index: string]: any } = {};
		_typedTempViews: { [index: string]: any } = {};
		_bytes: Uint8Array;

		// The get() utility function used by the get methods
		_get(type: any, size: number, offset?: number, le?: boolean)
		{
			if (offset === undefined)
				throw new Error("Missing required offset argument");

			if (offset < 0 || offset + size > this.byteLength)
				throw new Error("Invalid index: " + offset);

			var key = type.toString();
			var temp = DataView.temp;
			var bytes = this._bytes;

			if (size === 1 || !!le === DataView.nativele)
			{
				// This is the easy case: the desired endianness
				// matches the native endianness.

				// Typed arrays require proper alignment.  DataView does not.
				if ((this.byteOffset + offset) % size === 0)
				{
					var typedView = this._typedViews[key];
					if (!typedView)
						typedView = this._typedViews[key] = new type(this.buffer, 0, Math.floor(this.buffer.byteLength / size));

					return typedView[(this.byteOffset + offset) / size];
				}

				// Copy bytes into the temp array, to fix alignment
				for (var i = 0; i < size; ++i)
					temp[i] = bytes[offset + i];
			}
			else
			{
				// If the native endianness doesn't match the desired, then
				// we have to reverse the bytes
				for (var i = 0; i < size; ++i)
					temp[size - i - 1] = bytes[offset + i];
			}

			var typedTempView = this._typedTempViews[key];
			if (!typedTempView)
				typedTempView = this._typedTempViews[key] = new type(temp.buffer, 0, 1);

			return typedTempView[0];
		}

		// The set() utility function used by the set methods
		_set(type: any, size: number, offset: number, value: number, le?: boolean)
		{
			if (offset === undefined) throw new Error("Missing required offset argument");
			if (value === undefined) throw new Error("Missing required value argument");

			if (offset < 0 || offset + size > this.byteLength)
				throw new Error("Invalid index: " + offset);

			var temp = DataView.temp;
			var bytes = this._bytes;

			if (size === 1 || !!le === DataView.nativele)
			{
				// This is the easy case: the desired endianness
				// matches the native endianness.
				if ((this.byteOffset + offset) % size === 0)
				{
					(new type(this.buffer, this.byteOffset + offset, 1))[0] = value;
				}
				else
				{
					(new type(temp.buffer))[0] = value;
					// Now copy the bytes into the this's buffer
					for (var i = 0; i < size; ++i)
						bytes[i + offset] = temp[i];
				}
			}
			else
			{
				// If the native endianness doesn't match the desired, then
				// we have to reverse the bytes

				// Store the value into our temporary buffer
				(new type(temp.buffer))[0] = value;

				// Now copy the bytes, in reverse order, into the this's buffer
				for (var i = 0; i < size; ++i)
					bytes[offset + i] = temp[size - 1 - i];
			}
		}


		constructor (buffer: ArrayBuffer, offset = 0, length: number = buffer.byteLength - offset)
		{
			if (!(buffer instanceof ArrayBuffer))
				throw new Error("Bad ArrayBuffer");

			if (offset < 0 || length < 0 || offset + length > buffer.byteLength)
				throw new Error("Illegal offset and/or length");

			this._bytes = new Uint8Array(buffer, offset, length);

			// Define the 3 read-only, non-enumerable ArrayBufferView properties
			Object.defineProperties(this, {
				buffer: {
					value: buffer,
					enumerable: false, writable: false, configurable: false
				},
				byteOffset: {
					value: offset,
					enumerable: false, writable: false, configurable: false
				},
				byteLength: {
					value: length,
					enumerable: false, writable: false, configurable: false
				},
			});

			this.getInt8 = <any> this._get.bind(this, Int8Array, 1);
			this.getUint8 = <any> this._get.bind(this, Uint8Array, 1);

			this.getInt16 = <any> this._get.bind(this, Int16Array, 2);
			this.getUint16 = <any> this._get.bind(this, Uint16Array, 2);

			this.getInt32 = <any> this._get.bind(this, Int32Array, 4);
			this.getUint32 = <any> this._get.bind(this, Uint32Array, 4);

			this.getFloat32 = <any> this._get.bind(this, Float32Array, 8);
			this.getFloat64 = <any> this._get.bind(this, Float64Array, 8);


			this.setInt8 = <any> this._set.bind(this, Int8Array, 1);
			this.setUint8 = <any> this._set.bind(this, Uint8Array, 1);

			this.setInt16 = <any> this._set.bind(this, Int16Array, 2);
			this.setUint16 = <any> this._set.bind(this, Uint16Array, 2);

			this.setInt32 = <any> this._set.bind(this, Int32Array, 4);
			this.setUint32 = <any> this._set.bind(this, Uint32Array, 4);

			this.setFloat32 = <any> this._set.bind(this, Float32Array, 8);
			this.setFloat64 = <any> this._set.bind(this, Float64Array, 8);
		}
			getInt8: (type: any, size: number, offset?: number, le?: boolean) => number;
		getInt16: (type: any, size: number, offset?: number, le?: boolean) => number;
		getInt32: (type: any, size: number, offset?: number, le?: boolean) => number;

		getUint8: (type: any, size: number, offset?: number, le?: boolean) => number;
		getUint16: (type: any, size: number, offset?: number, le?: boolean) => number;
		getUint32: (type: any, size: number, offset?: number, le?: boolean) => number;

		getFloat32: (type: any, size: number, offset?: number, le?: boolean) => number;
		getFloat64: (type: any, size: number, offset?: number, le?: boolean) => number;


		setInt8: (type: any, size: number, offset: number, value: number, le?: boolean) => void;
		setInt16: (type: any, size: number, offset: number, value: number, le?: boolean) => void;
		setInt32: (type: any, size: number, offset: number, value: number, le?: boolean) => void;

		setUint8: (type: any, size: number, offset: number, value: number, le?: boolean) => void;
		setUint16: (type: any, size: number, offset: number, value: number, le?: boolean) => void;
		setUint32: (type: any, size: number, offset: number, value: number, le?: boolean) => void;

		setFloat32: (type: any, size: number, offset: number, value: number, le?: boolean) => void;
		setFloat64: (type: any, size: number, offset: number, value: number, le?: boolean) => void;

	}

}