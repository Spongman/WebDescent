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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var DataView_;
(function (DataView_) {
    // If DataView already exists, do nothing
    // if (DataView)
    // 	return;
    // If ArrayBuffer is not supported, fail with an error
    if (!ArrayBuffer) {
        throw new Error("ArrayBuffer not supported");
    }
    // If ES5 is not supported, fail
    if (!Object.defineProperties) {
        throw new Error("This module requires ECMAScript 5");
    }
    // A temporary array for copying or reversing bytes into.
    // Since js is single-threaded, we only need this one static copy
    // The DataView() constructor
    var DataView = /** @class */ (function () {
        function DataView(buffer, offset, length) {
            if (offset === void 0) { offset = 0; }
            if (length === void 0) { length = buffer.byteLength - offset; }
            this._typedViews = {};
            this._typedTempViews = {};
            if (!(buffer instanceof ArrayBuffer)) {
                throw new Error("Bad ArrayBuffer");
            }
            if (offset < 0 || length < 0 || offset + length > buffer.byteLength) {
                throw new Error("Illegal offset and/or length");
            }
            this._bytes = new Uint8Array(buffer, offset, length);
            // Define the 3 read-only, non-enumerable ArrayBufferView properties
            Object.defineProperties(this, {
                buffer: {
                    value: buffer,
                    enumerable: false, writable: false, configurable: false,
                },
                byteOffset: {
                    value: offset,
                    enumerable: false, writable: false, configurable: false,
                },
                byteLength: {
                    value: length,
                    enumerable: false, writable: false, configurable: false,
                },
            });
            this.getInt8 = this._get.bind(this, Int8Array, 1);
            this.getUint8 = this._get.bind(this, Uint8Array, 1);
            this.getInt16 = this._get.bind(this, Int16Array, 2);
            this.getUint16 = this._get.bind(this, Uint16Array, 2);
            this.getInt32 = this._get.bind(this, Int32Array, 4);
            this.getUint32 = this._get.bind(this, Uint32Array, 4);
            this.getFloat32 = this._get.bind(this, Float32Array, 8);
            this.getFloat64 = this._get.bind(this, Float64Array, 8);
            this.setInt8 = this._set.bind(this, Int8Array, 1);
            this.setUint8 = this._set.bind(this, Uint8Array, 1);
            this.setInt16 = this._set.bind(this, Int16Array, 2);
            this.setUint16 = this._set.bind(this, Uint16Array, 2);
            this.setInt32 = this._set.bind(this, Int32Array, 4);
            this.setUint32 = this._set.bind(this, Uint32Array, 4);
            this.setFloat32 = this._set.bind(this, Float32Array, 8);
            this.setFloat64 = this._set.bind(this, Float64Array, 8);
        }
        // The get() utility function used by the get methods
        DataView.prototype._get = function (type, size, offset, le) {
            if (offset === undefined) {
                throw new Error("Missing required offset argument");
            }
            if (offset < 0 || offset + size > this.byteLength) {
                throw new Error("Invalid index: " + offset);
            }
            var key = type.toString();
            var temp = DataView.temp;
            var bytes = this._bytes;
            if (size === 1 || !!le === DataView.nativele) {
                // This is the easy case: the desired endianness
                // matches the native endianness.
                // Typed arrays require proper alignment.  DataView does not.
                if ((this.byteOffset + offset) % size === 0) {
                    var typedView = this._typedViews[key];
                    if (!typedView) {
                        typedView = this._typedViews[key] = new type(this.buffer, 0, Math.floor(this.buffer.byteLength / size));
                    }
                    return typedView[(this.byteOffset + offset) / size];
                }
                // Copy bytes into the temp array, to fix alignment
                for (var i = 0; i < size; ++i) {
                    temp[i] = bytes[offset + i];
                }
            }
            else {
                // If the native endianness doesn't match the desired, then
                // we have to reverse the bytes
                for (var i = 0; i < size; ++i) {
                    temp[size - i - 1] = bytes[offset + i];
                }
            }
            var typedTempView = this._typedTempViews[key];
            if (!typedTempView) {
                typedTempView = this._typedTempViews[key] = new type(temp.buffer, 0, 1);
            }
            return typedTempView[0];
        };
        // The set() utility function used by the set methods
        DataView.prototype._set = function (type, size, offset, value, le) {
            if (offset === undefined) {
                throw new Error("Missing required offset argument");
            }
            if (value === undefined) {
                throw new Error("Missing required value argument");
            }
            if (offset < 0 || offset + size > this.byteLength) {
                throw new Error("Invalid index: " + offset);
            }
            var temp = DataView.temp;
            var bytes = this._bytes;
            if (size === 1 || !!le === DataView.nativele) {
                // This is the easy case: the desired endianness
                // matches the native endianness.
                if ((this.byteOffset + offset) % size === 0) {
                    (new type(this.buffer, this.byteOffset + offset, 1))[0] = value;
                }
                else {
                    (new type(temp.buffer))[0] = value;
                    // Now copy the bytes into the this's buffer
                    for (var i = 0; i < size; ++i) {
                        bytes[i + offset] = temp[i];
                    }
                }
            }
            else {
                // If the native endianness doesn't match the desired, then
                // we have to reverse the bytes
                // Store the value into our temporary buffer
                (new type(temp.buffer))[0] = value;
                // Now copy the bytes, in reverse order, into the this's buffer
                for (var i = 0; i < size; ++i) {
                    bytes[offset + i] = temp[size - 1 - i];
                }
            }
        };
        // Figure if the platform is natively little-endian.
        // If the integer 0x00000001 is arranged in memory as 01 00 00 00 then
        // we're on a little endian platform. On a big-endian platform we'd get
        // get bytes 00 00 00 01 instead.
        DataView.nativele = new Int8Array(new Int32Array([1]).buffer)[0] === 1;
        DataView.temp = new Uint8Array(8);
        return DataView;
    }());
})(DataView_ || (DataView_ = {}));
if (typeof ArrayBuffer === "undefined") {
    throw new Error("ArrayBuffer not supported");
}
if (typeof DataView === "undefined") {
    throw new Error("DataView not supported");
}
if (typeof Object.defineProperties === "undefined") {
    throw new Error("This module requires ECMAScript 5");
}
var DataStream = /** @class */ (function () {
    // The DataStream() constructor
    function DataStream(view, littleEndian) {
        if (littleEndian === void 0) { littleEndian = true; }
        this.position = 0;
        this.littleEndian = false;
        if (view instanceof ArrayBuffer) {
            view = new DataView(view);
        }
        else if (!(view instanceof DataView)) {
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
    DataStream.prototype.getInt8 = function () {
        var value = this.view.getInt8(this.position);
        this.position++;
        return value;
    };
    DataStream.prototype.getUint8 = function () {
        var value = this.view.getUint8(this.position);
        this.position++;
        return value;
    };
    DataStream.prototype.getInt16 = function () {
        var value = this.view.getInt16(this.position, this.littleEndian);
        this.position += 2;
        return value;
    };
    DataStream.prototype.getUint16 = function () {
        var value = this.view.getUint16(this.position, this.littleEndian);
        this.position += 2;
        return value;
    };
    DataStream.prototype.getInt32 = function () {
        var value = this.view.getInt32(this.position, this.littleEndian);
        this.position += 4;
        return value;
    };
    DataStream.prototype.getUint32 = function () {
        var value = this.view.getUint32(this.position, this.littleEndian);
        this.position += 4;
        return value;
    };
    DataStream.prototype.getFloat32 = function () {
        var value = this.view.getFloat32(this.position, this.littleEndian);
        this.position += 4;
        return value;
    };
    DataStream.prototype.getFloat64 = function () {
        var value = this.view.getFloat64(this.position, this.littleEndian);
        this.position += 8;
        return value;
    };
    DataStream.prototype.getString = function (length) {
        if (typeof length !== "number") {
            throw new Error("bad type for length: " + typeof length);
        }
        if (length < 0 || this.position + length > this.byteLength) {
            throw new Error("INDEX_SIZE_ERR: DOM Exception 1");
        }
        var value = "";
        for (var i = 0; i < length; ++i) {
            var b = this.getUint8();
            if (b > 127) {
                b = 0xfffd;
            }
            value += String.fromCharCode(b);
        }
        return value;
    };
    DataStream.prototype.getTerminatedString = function (terminators, length) {
        var value = "";
        var start = this.position;
        while (true) {
            if (length && value.length >= length) {
                break;
            }
            var b = this.getUint8();
            if (b > 127) {
                b = 0xfffd;
            }
            var ch = String.fromCharCode(b);
            if (terminators.indexOf(ch) >= 0) {
                break;
            }
            value += ch;
        }
        if (length) {
            this.position = start + length;
        }
        return value;
    };
    DataStream.prototype.getFixed = function () {
        return fix(this.getInt32());
    };
    DataStream.prototype.getFixed2 = function () {
        return fix2(this.getInt16());
    };
    DataStream.prototype.getVector = function () {
        var x = this.getFixed();
        var y = this.getFixed();
        var z = this.getFixed();
        if (x === 0 && y === 0 && z === 0) {
            return Vec3.Zero;
        }
        return new Vec3(x, y, z);
    };
    DataStream.prototype.getVector2 = function () {
        var x = this.getFixed2();
        var y = this.getFixed2();
        var z = this.getFixed2();
        if (x === 0 && y === 0 && z === 0) {
            return Vec3.Zero;
        }
        return new Vec3(x, y, z);
    };
    DataStream.prototype.getMatrix = function () {
        return new Mat3(this.getVector(), this.getVector(), this.getVector());
    };
    DataStream.prototype.getRGB = function () {
        var r = this.getUint8();
        var g = this.getUint8();
        var b = this.getUint8();
        return (r << 16) | (g << 8) | b;
    };
    DataStream.prototype.getColor15 = function () {
        var rgb = this.getUint16();
        var r = ((rgb >> 10) & 31) / 31;
        var g = ((rgb >> 5) & 31) / 31;
        var b = (rgb & 31) / 31;
        return new Vec3(r, g, b);
    };
    DataStream.prototype.getInt8Array = function (count) { return Array_iterate(count, this.getInt8.bind(this)); };
    DataStream.prototype.getInt16Array = function (count) { return Array_iterate(count, this.getInt16.bind(this)); };
    DataStream.prototype.getInt32Array = function (count) { return Array_iterate(count, this.getInt32.bind(this)); };
    DataStream.prototype.getUint8Array = function (count) { return Array_iterate(count, this.getUint8.bind(this)); };
    DataStream.prototype.getUint16Array = function (count) { return Array_iterate(count, this.getUint16.bind(this)); };
    DataStream.prototype.getUint32Array = function (count) { return Array_iterate(count, this.getUint32.bind(this)); };
    DataStream.prototype.getVectorArray = function (count) { return Array_iterate(count, this.getVector.bind(this)); };
    DataStream.prototype.getVector2Array = function (count) { return Array_iterate(count, this.getVector2.bind(this)); };
    DataStream.prototype.getRGBArray = function (count) { return Array_iterate(count, this.getRGB.bind(this)); };
    DataStream.prototype.getFixedArray = function (count) { return Array_iterate(count, this.getFixed.bind(this)); };
    return DataStream;
}());
DataView.prototype.slice = function (offset, length) {
    if (!(offset >= 0 && offset + length <= this.byteLength)) {
        throw new Error("Invalid index: " + offset);
    }
    return new DataView(this.buffer, this.byteOffset + offset, length);
};
(function (Math, Array) {
    var _round = Math.round;
    var _rgPowers = new Float32Array(10);
    Math.round = function (value, digits) {
        if (digits == null) {
            return _round(value);
        }
        if (digits >= 0 || digits < 10) {
            var scale = _rgPowers[digits];
            if (!scale) {
                scale = _rgPowers[digits] = Math.pow(10, digits);
            }
            return _round(value * scale) / scale;
        }
        else {
            throw new Error("invalid precision: " + digits);
        }
    };
    Math.mod = function (a, b) {
        return a - b * Math.floor(a / b);
    };
})(Math, Array);
function assert(f) {
    if (!f) {
        throw new Error("assertion failed");
    }
}
function notNull(f) {
    if (f == null) {
        throw new Error("unexpected null|undefined");
    }
    return f;
}
Array.prototype.mapConcat = function (callback, thisArg) {
    var rg = [];
    var push = Array.prototype.push;
    for (var i = 0; i < this.length; ++i) {
        push.apply(rg, callback.call(thisArg, this[i], i, this));
    }
    return rg;
};
Array.prototype.checkIndex = function (i) {
    if (i < 0 || i >= this.length) {
        throw new Error("index out of range: " + i);
    }
};
Array.prototype.removeAt = function (i) {
    this.checkIndex(i);
    var old = this[i];
    this.splice(i, 1);
    return old;
};
Array.prototype.swapOut = function (i) {
    this.checkIndex(i);
    var old = this[i];
    var other = this.pop();
    if (this.length && old !== other) {
        this[i] = other;
    }
    return old;
};
function Array_iterate(count, callback) {
    var rg = [];
    for (var i = 0; i < count; ++i) {
        var value = callback(i);
        if (typeof value !== "undefined") {
            rg.push(value);
        }
    }
    return rg;
}
var __unique = 1;
function fix(v) { return v / 65536; }
function fix2(v) { return v / 256; }
var Vec2 = /** @class */ (function () {
    function Vec2(x, y) {
        this.x = x;
        this.y = y;
        if (isNaN(x) || isNaN(y)) {
            throw new Error("invalid value");
        }
    }
    Vec2.prototype.add = function (v) {
        return new Vec2(this.x + v.x, this.y + v.y);
    };
    Vec2.prototype.addScale = function (v, scale) {
        return new Vec2(this.x + v.x * scale, this.y + v.y * scale);
    };
    Vec2.prototype.sub = function (v) {
        return new Vec2(this.x - v.x, this.y - v.y);
    };
    Vec2.prototype.scale = function (s) {
        if (s === 0) {
            return Vec2.Zero;
        }
        if (s === 1) {
            return this;
        }
        return new Vec2(this.x * s, this.y * s);
    };
    Vec2.prototype.unit = function () {
        var len = this.len2();
        if (len === 1) {
            return this;
        }
        return this.scale(1 / Math.sqrt(len));
    };
    Vec2.prototype.len2 = function () {
        return this.x * this.x + this.y * this.y;
    };
    Vec2.prototype.len = function () {
        return Math.sqrt(this.len2());
    };
    Vec2.prototype.dot = function (v) {
        return this.x * v.x + this.y * v.y;
    };
    Vec2.prototype.projectOnTo = function (n) {
        return n.scale(n.dot(this) / n.len());
    };
    Vec2.prototype.pushTo = function (array) {
        array.push(this.x, this.y);
    };
    Vec2.prototype.flatten = function () {
        var flattened = this._flattened;
        if (!flattened) {
            flattened = this._flattened = [this.x, this.y];
        }
        return flattened;
    };
    Vec2.prototype.toString = function () {
        return "(" + Math.round(this.x, 3) + ", " + Math.round(this.y, 3) + ")";
    };
    Vec2.Zero = new Vec2(0, 0);
    Vec2.One = new Vec2(1, 1);
    Vec2.X = new Vec2(1, 0);
    Vec2.Y = new Vec2(0, 1);
    return Vec2;
}());
var Vec3 = /** @class */ (function () {
    function Vec3(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            throw new Error("invalid value");
        }
    }
    Vec3.prototype.add = function (v) {
        return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
    };
    Vec3.prototype.addScale = function (v, scale) {
        return new Vec3(this.x + v.x * scale, this.y + v.y * scale, this.z + v.z * scale);
    };
    Vec3.prototype.sub = function (v) {
        return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
    };
    Vec3.prototype.scale = function (s) {
        if (s === 0) {
            return Vec3.Zero;
        }
        if (s === 1) {
            return this;
        }
        return new Vec3(this.x * s, this.y * s, this.z * s);
    };
    Vec3.prototype.unit = function () {
        var len = this.len2();
        if (len === 1) {
            return this;
        }
        return this.scale(1 / Math.sqrt(len));
    };
    Vec3.prototype.len2 = function () {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    };
    Vec3.prototype.len = function () {
        var len = this._len;
        if (!len) {
            len = this._len = Math.sqrt(this.len2());
        }
        return len;
    };
    Vec3.prototype.dot = function (v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    };
    Vec3.prototype.neg = function () {
        return new Vec3(-this.x, -this.y, -this.z);
    };
    Vec3.prototype.cross = function (v) {
        return new Vec3(this.y * v.z - v.y * this.z, this.z * v.x - v.z * this.x, this.x * v.y - v.x * this.y);
    };
    Vec3.prototype.projectOnTo = function (n) {
        return n.scale(n.dot(this) / n.len());
    };
    Vec3.prototype.projectOnToPlane = function (normal) {
        return this.sub(this.projectOnTo(normal));
    };
    Vec3.prototype.planeNormal = function (p1, p2) {
        var v1 = p1.sub(this);
        var v2 = p2.sub(this);
        return v1.cross(v2).unit();
    };
    Vec3.prototype.distanceTo = function (p) {
        return Math.sqrt(this.distanceTo2(p));
    };
    Vec3.prototype.distanceTo2 = function (p) {
        var dx = this.x - p.x;
        var dy = this.y - p.y;
        var dz = this.z - p.z;
        return dx * dx + dy * dy + dz * dz;
    };
    Vec3.prototype.distanceToPlane = function (p, n) {
        return this.sub(p).dot(n);
    };
    Vec3.prototype.pushTo = function (array) {
        array.push(this.x, this.y, this.z);
    };
    Vec3.prototype.flatten = function () {
        var flattened = this._flattened;
        if (!flattened) {
            flattened = this._flattened = [this.x, this.y, this.z];
        }
        return flattened;
    };
    /*
    toV3()
    {
        return $V([this.x, this.y, this.z]);
    }
    toV4()
    {
        return $V([this.x, this.y, this.z, 1]);
    }
    */
    Vec3.prototype.toString = function () {
        return "(" + Math.round(this.x, 3) + ", " + Math.round(this.y, 3) + ", " + Math.round(this.z, 3) + ")";
    };
    Vec3.Zero = new Vec3(0, 0, 0);
    Vec3.One = new Vec3(1, 1, 1);
    Vec3.X = new Vec3(1, 0, 0);
    Vec3.Y = new Vec3(0, 1, 0);
    Vec3.Z = new Vec3(0, 0, 1);
    return Vec3;
}());
var Line3 = /** @class */ (function () {
    function Line3(start, direction) {
        this.start = start;
        this.direction = direction;
    }
    Line3.prototype.distanceToPlane = function (plane) {
        var dotprod = this.direction.dot(plane.normal.unit());
        if (dotprod <= 0) {
            return null;
        } // wrong direction
        return plane.anchor.sub(this.start).dot(plane.normal) / dotprod;
    };
    Line3.prototype.intersectPlane = function (plane) {
        var distance = this.distanceToPlane(plane);
        if (!distance) {
            return null;
        }
        return this.proceed(distance);
    };
    Line3.prototype.interesctTriangle = function (tri) {
        var pt = this.intersectPlane(tri);
        if (pt && tri.containsPoint(pt)) {
            return pt;
        }
        return null;
    };
    Line3.prototype.proceed = function (distance) {
        return this.start.addScale(this.direction, distance / this.direction.len());
    };
    return Line3;
}());
var LineSegment = /** @class */ (function (_super) {
    __extends(LineSegment, _super);
    function LineSegment(start, end) {
        var _this = this;
        var direction = end.sub(start);
        var length = direction.len();
        _this = _super.call(this, start, direction.scale(1 / length)) || this;
        _this.length = length;
        _this.end = end;
        return _this;
    }
    LineSegment.prototype.center = function () {
        return this.proceed(this.length / 2);
    };
    LineSegment.prototype.distanceToSphere = function (center, radius) {
        var c = center.sub(this.start);
        var l = this.direction;
        var A = l.dot(c);
        var B = l.dot(l);
        var Q = A * A - B * (c.dot(c) - radius * radius);
        if (Q <= 0.0) {
            return NaN;
        }
        var d = (A - Math.sqrt(Q)) / B;
        if (d <= 0.0) {
            return NaN;
        }
        return d;
        /*

        const d = this.direction;

        const a = d.dot(d);
        const b = 2.0 * d.dot(this.start.sub(center));
        const c = center.dot(center) + this.start.dot(this.start) - 2.0 * center.dot(this.start) - radius * radius;

        const test = b * b - 4.0 * a * c;
        if (test <= 0.0)
            return;

        // Hit
        const u = (-b - Math.sqrt(test)) / (2.0 * a);
        return u / d.len();
        */
    };
    LineSegment.prototype.flatten = function () {
        var flattened = this._flattened;
        if (!flattened) {
            flattened = this._flattened = [this.start.x, this.start.y, this.start.z, this.end.x, this.end.y, this.end.z];
        }
        return flattened;
    };
    LineSegment.prototype.intersectPlane = function (plane) {
        var distance = this.distanceToPlane(plane);
        if (!distance) {
            return null;
        }
        if (distance > this.length) {
            return null;
        } // too far away
        return this.proceed(distance);
    };
    return LineSegment;
}(Line3));
var Plane3 = /** @class */ (function () {
    function Plane3(anchor, normal) {
        this.anchor = anchor;
        this.normal = normal;
    }
    Plane3.fromPoints = function (v0, v1, v2) {
        var u = v1.sub(v0);
        var v = v2.sub(v0);
        var normal = u.cross(v);
        return new Plane3(v0, normal);
    };
    Plane3.prototype.distanceTo = function (pt) {
        var n = this.normal;
        var a = this.anchor;
        return n.x * (pt.x - a.x) + n.y * (pt.y - a.y) + n.z * (pt.z - a.z);
    };
    Plane3.prototype.reverse = function () {
        return new Plane3(this.anchor, this.normal.scale(-1));
    };
    Plane3.prototype.pointClosestTo = function (vec) {
        return vec.addScale(this.normal, -vec.dot(this.normal));
    };
    Plane3.prototype.reflectVector = function (vec) {
        return vec.addScale(this.normal, -2 * vec.dot(this.normal));
    };
    Plane3.prototype.reflectPoint = function (pt) {
        return this.anchor.add(this.reflectVector(pt.sub(this.anchor)));
    };
    Plane3.prototype.toString = function () {
        return this.anchor.toString() + "/" + this.normal.toString();
    };
    Plane3.prototype.toReflectionMatrix = function () {
        var x = this.normal.x;
        var y = this.normal.y;
        var z = this.normal.z;
        return new Mat3(new Vec3(1 - 2 * x * x, -2 * x * y, -2 * x * z), new Vec3(-2 * x * y, 1 - 2 * y * y, -2 * y * z), new Vec3(-2 * z * x, -2 * z * y, 1 - 2 * z * z));
    };
    return Plane3;
}());
var Bounce = /** @class */ (function (_super) {
    __extends(Bounce, _super);
    function Bounce() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Bounce.prototype.getTextureCoords = function () {
        var side = this.side;
        var rgUV = side.rgUV;
        var uv0 = rgUV[0];
        var uv1;
        var uv2;
        if (this.iTri === 0) {
            uv1 = rgUV[1].sub(uv0);
            uv2 = rgUV[2].sub(uv0);
        }
        else {
            uv1 = rgUV[2].sub(uv0);
            uv2 = rgUV[3].sub(uv0);
        }
        var uv = this.tri.getParametricCoords(this.anchor);
        var v = uv0.addScale(uv1, uv.x).addScale(uv2, uv.y);
        return v;
    };
    return Bounce;
}(Plane3));
var Triangle = /** @class */ (function (_super) {
    __extends(Triangle, _super);
    function Triangle(v0, v1, v2) {
        var _this = this;
        var u = v1.sub(v0);
        var v = v2.sub(v0);
        var normal = u.cross(v).unit();
        _this = _super.call(this, v0, normal) || this;
        _this.rgPoints = [v0, v1, v2];
        _this.u = u;
        _this.v = v;
        _this.uu = u.dot(u);
        _this.uv = u.dot(v);
        _this.vv = v.dot(v);
        _this.D = _this.uv * _this.uv - _this.uu * _this.vv;
        return _this;
    }
    Triangle.prototype.containsPoint = function (pt) {
        var w = pt.sub(this.anchor);
        var wu = w.dot(this.u);
        var wv = w.dot(this.v);
        // get and test parametric coords
        var s = (this.uv * wv - this.vv * wu) / this.D;
        if (s < 0.0 || s > 1.0) {
            return false;
        }
        var t = (this.uv * wu - this.uu * wv) / this.D;
        if (t < 0.0 || (s + t) > 1.0) {
            return false;
        }
        return true;
    };
    Triangle.prototype.getParametricCoords = function (pt) {
        var w = pt.sub(this.anchor);
        // Compute dot products
        var uw = this.u.dot(w);
        var vw = this.v.dot(w);
        // Compute barycentric coordinates
        var u = (this.uv * vw - this.vv * uw) / this.D;
        var v = (this.uv * uw - this.uu * vw) / this.D;
        return new Vec2(u, v);
    };
    /*
    getProjectionMatrix()
    {
        const mat = Matrix.create([
            this.u.toV3(),
            this.v.projectOnTo(this.u.cross(this.normal)).toV3(),
            this.normal.scale(this.u.len()).toV3()
        ]);

        mat = mat.ensure4x4();

        mat = mat.inverse();
        mat = mat.transpose();

        const mt = Matrix.Translation(Vec3.Zero.sub(this.anchor).toV3());
        mat = mat.multiply(mt);

        return mat;
    }
    */
    Triangle.prototype.getCenter = function () {
        if (!this.center) {
            this.center = this.rgPoints[0]
                .add(this.rgPoints[1])
                .add(this.rgPoints[2])
                .scale(1 / 3);
        }
        return this.center;
    };
    Triangle.prototype.bounce = function (line, size) {
        var dotProduct = -this.normal.dot(line.direction);
        if (dotProduct <= 0) {
            return;
        } // triangle faces the wrong direction
        // the perpendicular distance from the start of the line to the plane
        var perpendicularDistanceToStart = this.distanceTo(line.start);
        // the distance from the start of the line to the point of collision
        var perpendicularDistanceToCollision = perpendicularDistanceToStart - size;
        // the distance along the line from the start to the collision
        var distanceToCollision = perpendicularDistanceToCollision / dotProduct;
        if (distanceToCollision > line.length) {
            return;
        } // too far away
        var contactPoint = line.proceed(distanceToCollision);
        if (!this.containsPoint(contactPoint)) {
            return;
        }
        var bounce = new Bounce(contactPoint, this.normal);
        bounce.tri = this;
        bounce.perpendicularDistance = perpendicularDistanceToCollision;
        bounce.distance = distanceToCollision;
        return bounce;
        /*
        const perpendicularDistance = this.distanceTo(line.end);

        // the distance perpendicular to the plane that we've overshot
        const perpendicularPenetration = size - perpendicularDistance;

        if (perpendicularPenetration < 1e-13)
            return;	// too far away

        // the distance along the line that we've overshot
        const penetration = -perpendicularPenetration / dotProduct;

        // the point at which contact occurred
        const contactPoint = line.end.addScale(line.direction, -penetration);
        if (!this.containsPoint(contactPoint))
            return;

        const bounce = new Plane3(contactPoint, this.normal);
        bounce.tri = this;
        bounce.perpendicularDistance = perpendicularDistance;
        bounce.distance = line.length - penetration;
        return bounce;
        */
    };
    return Triangle;
}(Plane3));
var Mat3 = /** @class */ (function () {
    function Mat3(r0, r1, r2) {
        if (r0 instanceof Array) {
            if (r0.length !== 3) {
                throw new Error("wrong length: " + r0.length);
            }
            if (typeof r1 !== "undefined" || typeof r2 !== "undefined") {
                throw new Error("can't pass additional arguments here");
            }
            this._ = r0;
        }
        else {
            this._ = [r0, r1, r2];
        }
        // Object.freeze(this);
    }
    Mat3.createRotation2d = function (angle) {
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        return new Mat3(new Vec3(c, -s, 0), new Vec3(s, c, 0), Vec3.Z);
    };
    Mat3.createTranslation2d = function (x, y) {
        if (x instanceof Vec2) {
            y = x.y;
            x = x.x;
        }
        return new Mat3(new Vec3(1, 0, x), new Vec3(0, 1, notNull(y)), Vec3.Z);
    };
    Mat3.fromEuler = function (p, h, b) {
        if (p instanceof Vec3) {
            b = p.z;
            h = p.y;
            p = p.x;
        }
        var sinp = Math.sin(p);
        var cosp = Math.cos(p);
        var sinb = Math.sin(b);
        var cosb = Math.cos(b);
        var sinh = Math.sin(h);
        var cosh = Math.cos(h);
        var sbsh = sinb * sinh;
        var cbch = cosb * cosh;
        var cbsh = cosb * sinh;
        var sbch = sinb * cosh;
        return new Mat3(new Vec3(cbch + sinp * sbsh, sinb * cosp, sinp * sbch - cbsh), new Vec3(sinp * cbsh - sbch, cosb * cosp, sbsh + sinp * cbch), new Vec3(sinh * cosp, -sinp, cosh * cosp));
    };
    Mat3.createRotation = function (angles) {
        var sinp = Math.sin(angles.x);
        var cosp = Math.cos(angles.x);
        var sinb = Math.sin(angles.z);
        var cosb = Math.cos(angles.z);
        var sinh = Math.sin(angles.y);
        var cosh = Math.cos(angles.y);
        var sbsh = sinb * sinh;
        var cbch = cosb * cosh;
        var cbsh = cosb * sinh;
        var sbch = sinb * cosh;
        return new Mat3(new Vec3(cbch + sinp * sbsh, sinb * cosp, sinp * sbch - cbsh), new Vec3(sinp * cbsh - sbch, cosb * cosp, sbsh + sinp * cbch), new Vec3(sinh * cosp, -sinp, cosh * cosp));
    };
    Mat3.prototype.add = function (other) {
        return new Mat3(this._[0].add(other._[0]), this._[1].add(other._[1]), this._[2].add(other._[2]));
    };
    Mat3.prototype.sub = function (other) {
        return new Mat3(this._[0].sub(other._[0]), this._[1].sub(other._[1]), this._[2].sub(other._[2]));
    };
    Mat3.prototype.scale = function (value) {
        return new Mat3(this._[0].scale(value), this._[1].scale(value), this._[2].scale(value));
    };
    Mat3.prototype.multiply = function (other) {
        if (other instanceof Vec3) {
            return this._[0].scale(other.x)
                .addScale(this._[1], other.y)
                .addScale(this._[2], other.z);
        }
        var rows = [];
        for (var i = 0; i < 3; ++i) {
            var vx = this._[i].x * other._[0].x +
                this._[i].y * other._[1].x +
                this._[i].z * other._[2].x;
            var vy = this._[i].x * other._[0].y +
                this._[i].y * other._[1].y +
                this._[i].z * other._[2].y;
            var vz = this._[i].x * other._[0].z +
                this._[i].y * other._[1].z +
                this._[i].z * other._[2].z;
            rows.push(new Vec3(vx, vy, vz));
        }
        return new Mat3(rows);
    };
    Mat3.prototype.transpose = function () {
        return new Mat3([
            new Vec3(this._[0].x, this._[1].x, this._[2].x),
            new Vec3(this._[0].y, this._[1].y, this._[2].y),
            new Vec3(this._[0].z, this._[1].z, this._[2].z),
        ]);
    };
    Mat3.prototype.rotate = function (v) {
        return new Vec3(this._[0].dot(v), this._[1].dot(v), this._[2].dot(v));
    };
    Mat3.prototype.rotate2d = function (angle) {
        return Mat3.createRotation2d(angle).multiply(this);
    };
    Mat3.prototype.translate2d = function (x, y) {
        return Mat3.createTranslation2d(x, y).multiply(this);
    };
    Mat3.prototype.flatten = function () {
        var flattened = this._flattened;
        if (!flattened) {
            flattened = this._flattened = [];
            this._[0].pushTo(flattened);
            this._[1].pushTo(flattened);
            this._[2].pushTo(flattened);
        }
        return flattened;
    };
    Mat3.prototype.toMat4 = function () {
        return new Mat4([
            [this._[0].x, this._[0].y, this._[0].z, 0],
            [this._[1].x, this._[1].y, this._[1].z, 0],
            [this._[2].x, this._[2].y, this._[2].z, 0],
            [0, 0, 0, 1],
        ]);
    };
    Mat3.I = new Mat3(Vec3.X, Vec3.Y, Vec3.Z);
    Mat3.createLook = function (forward, up, right) {
        var x, y;
        var z = forward.unit();
        if (up) {
            y = up.unit();
            x = y.cross(z);
        }
        else {
            if (right) {
                x = right.unit();
            }
            else {
                x = new Vec3(z.z, 0, -z.x).unit();
            }
            y = z.cross(x);
        }
        return new Mat3(x, y, z);
    };
    return Mat3;
}());
var Mat4 = /** @class */ (function () {
    function Mat4(arg) {
        if (arg[0].length) {
            this.elements = new Float32Array(16);
            for (var col = 4; col--;) {
                for (var row = 4; row--;) {
                    this.elements[row + col * 4] = arg[row][col];
                }
            }
        }
        else {
            this.elements = arg;
        }
    }
    Mat4.createPerspective = function (fovy, aspect, znear, zfar) {
        var ymax = znear * Math.tan(fovy * Math.PI / 360.0);
        var ymin = -ymax;
        var xmin = ymin * aspect;
        var xmax = ymax * aspect;
        return Mat4.createFrustum(xmin, xmax, ymin, ymax, znear, zfar);
    };
    Mat4.createPerspective2 = function (fovy, aspect, near, far) {
        var out = new Float32Array(16);
        var f = 1.0 / Math.tan(fovy / 2);
        var nf = 1 / (near - far);
        out[0] = f / aspect;
        out[1] = 0;
        out[2] = 0;
        out[3] = 0;
        out[4] = 0;
        out[5] = f;
        out[6] = 0;
        out[7] = 0;
        out[8] = 0;
        out[9] = 0;
        out[10] = (far + near) * nf;
        out[11] = -1;
        out[12] = 0;
        out[13] = 0;
        out[14] = (2 * far * near) * nf;
        out[15] = 0;
        return new Mat4(out);
    };
    Mat4.createLookAt = function (cameraPosition, cameraTarget, cameraUpVector) {
        var vz = cameraPosition.sub(cameraTarget).unit();
        var vx = cameraUpVector.cross(vz).unit();
        var vy = vz.cross(vx);
        var tx = -vx.dot(cameraPosition);
        var ty = -vy.dot(cameraPosition);
        var tz = -vz.dot(cameraPosition);
        return new Mat4([
            [vx.x, vy.x, vz.x, 0],
            [vx.y, vy.y, vz.y, 0],
            [vx.z, vy.z, vz.z, 0],
            [tx, ty, tz, 1],
        ]);
    };
    Mat4.createTranslation = function (t) {
        return new Mat4([
            [1, 0, 0, t.x],
            [0, 1, 0, t.y],
            [0, 0, 1, t.z],
            [0, 0, 0, 1],
        ]);
    };
    // from http://en.wikibooks.org/wiki/GLSL_Programming/Vertex_Transformations
    Mat4.createFrustum = function (l, r, b, t, n, f) {
        var dx = r - l;
        var dy = t - b;
        var dz = f - n;
        var X = 2 * n / dx;
        var Y = 2 * n / dy;
        var A = (r + l) / dx;
        var B = (t + b) / dy;
        var C = -(f + n) / dz;
        var D = -2 * n * f / dz;
        return new Mat4([
            [X, 0, A, 0],
            [0, Y, B, 0],
            [0, 0, C, -D],
            [0, 0, 1, 0],
        ]);
    };
    Mat4.prototype.multiply = function (m) {
        var eltsL = this.elements;
        var eltsR = m.elements;
        var res = new Float32Array(16);
        for (var row = 4; row--;) {
            for (var col = 4; col--;) {
                res[row + col * 4] =
                    eltsL[row + 0 * 4] * eltsR[0 + col * 4] +
                        eltsL[row + 1 * 4] * eltsR[1 + col * 4] +
                        eltsL[row + 2 * 4] * eltsR[2 + col * 4] +
                        eltsL[row + 3 * 4] * eltsR[3 + col * 4];
            }
        }
        return new Mat4(res);
    };
    Mat4.prototype.flatten = function () { return this.elements; };
    Mat4.prototype.getRow = function (row) {
        return [
            this.elements[row + 0 * 4],
            this.elements[row + 1 * 4],
            this.elements[row + 2 * 4],
            this.elements[row + 3 * 4],
        ];
    };
    Mat4.I = new Mat4([
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
    ]);
    return Mat4;
}());
var gl;
function createProgram(name, attrs, uniforms) {
    function compileShader(shaderType, str) {
        var shader = gl.createShader(shaderType);
        gl.shaderSource(shader, str);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            var error = gl.getShaderInfoLog(shader);
            throw new Error("Error compiling " + shaderType + ":\n" + error);
        }
        return shader;
    }
    return $.when($.get("assets/shaders/" + name + ".vs.glsl"), $.get("assets/shaders/" + name + ".fs.glsl")).then(function (vsArgs, fsArgs) {
        var program = notNull(gl.createProgram());
        gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsArgs[0] + "\n//" + name + ".vs"));
        gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsArgs[0] + "\n//" + name + ".fs"));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            alert("LINK: Could not initialise shaders");
        }
        useProgram(program);
        $.each(attrs, function (i, e) {
            var loc = gl.getAttribLocation(program, e);
            if (!(loc >= 0)) {
                throw new Error(name + ": attribute '" + e + "' not found!");
            }
            program[e] = loc;
            // console.log(vs + " ATTR " + e + " = " + loc);
            // gl.enableVertexAttribArray(loc);
        });
        $.each(uniforms, function (i, e) {
            var loc = gl.getUniformLocation(program, e);
            if (!loc) {
                throw new Error(name + ": uniform '" + e + "' not found!");
            }
            program[e] = loc;
        });
        return program;
    });
}
var programDouble;
var programSingle;
var programFlat;
var programBillboard;
var programBillboardX;
var programLit;
var rgPrograms;
function initShaders() {
    var rgBillboardVertexPositions = [
        new Vec2(0, 0),
        new Vec2(0, 1),
        new Vec2(1, 1),
        new Vec2(1, 0),
    ];
    return $.when(createProgram("double", [
        "aVertexPosition",
        "aVertexTextureCoord",
        "aVertexLight",
        "aVertexBrightness",
    ], [
        "matProjection",
        "matModelView",
        "slide",
        "alpha",
        "sampPalette",
        "matOrientTex2",
        "sampTexture1",
        "sampTexture2",
    ]).done(function (program) {
        programDouble = program;
        gl.uniform1i(programDouble.sampPalette, 0);
        gl.uniform1i(programDouble.sampTexture1, 1);
        gl.uniform1i(programDouble.sampTexture2, 2);
        gl.uniform1f(programDouble.alpha, 1.0);
    }), createProgram("single", [
        "aVertexPosition",
        "aVertexTextureCoord",
        "aVertexLight",
        "aVertexBrightness",
    ], [
        "matProjection",
        "matModelView",
        "sampPalette",
        "slide",
        "alpha",
        "sampTexture",
    ]).done(function (program) {
        programSingle = program;
        gl.uniform1i(programSingle.sampPalette, 0);
        gl.uniform1i(programSingle.sampTexture, 1);
        gl.uniform1f(programSingle.alpha, 1.0);
    }), createProgram("lit", [
        "aVertexPosition",
        "aVertexTextureCoord",
    ], [
        "matProjection",
        "matModelView",
        "sampTexture",
        "sampPalette",
        "light",
    ]).done(function (program) {
        programLit = program;
        gl.uniform1i(programLit.sampPalette, 0);
        gl.uniform1i(programLit.sampTexture, 1);
    }), createProgram("flat", [
        "aVertexPosition",
        "aVertexColor",
    ], [
        "matProjection",
        "matModelView",
        "light",
    ]).done(function (program) {
        programFlat = program;
    }), createProgram("billboard", [
        "aVertexPosition",
    ], [
        "matProjection",
        "matModelView",
        "sampTexture",
        "sampPalette",
        "sizeTexture",
        "scale",
        // "alpha",
        "pos",
    ]).done(function (program) {
        programBillboard = program;
        gl.uniform1i(programBillboard.sampPalette, 0);
        gl.uniform1i(programBillboard.sampTexture, 1);
        programBillboard.bufferVertexPosition = createBuffer(Array.prototype.concat.apply([], rgBillboardVertexPositions.map(function (v) { return v.flatten(); })), 2);
        loadAttribBuffer(programBillboard.aVertexPosition, programBillboard.bufferVertexPosition);
    }), createProgram("billboard-x", [
        "aVertexPosition",
    ], [
        "matProjection",
        "matModelView",
        "sampTexture",
        "sampPalette",
        "sizeTexture",
        "scale",
        // "alpha",
        "pos",
        "eye",
    ]).done(function (program) {
        programBillboardX = program;
        gl.uniform1i(programBillboardX.sampPalette, 0);
        gl.uniform1i(programBillboardX.sampTexture, 1);
        programBillboardX.bufferVertexPosition = createBuffer(Array.prototype.concat.apply([], rgBillboardVertexPositions.map(function (v) { return v.flatten(); })), 2);
        loadAttribBuffer(programBillboardX.aVertexPosition, programBillboardX.bufferVertexPosition);
    })).done(function () {
        rgPrograms = $.makeArray(arguments);
    });
}
var _rgTextures = new Array(5);
var _activeTexture;
function bindTexture(iUnit, tex) {
    if (_rgTextures[iUnit] === tex) {
        return;
    }
    _rgTextures[iUnit] = tex;
    if (_activeTexture !== iUnit) {
        _activeTexture = iUnit;
        gl.activeTexture(gl.TEXTURE0 + iUnit);
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
}
// create an image from an array of single-byte values
function createTexture(iUnit, filter) {
    var texImage = gl.createTexture();
    if (!texImage) {
        throw new Error("failed to create texture");
    }
    bindTexture(iUnit || 0, texImage);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.NEAREST);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    // gl.generateMipmap(gl.TEXTURE_2D);
    return texImage;
}
function initPalette(rgColors) {
    var tex = createTexture(0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    updatePalette(tex, rgColors);
    return tex;
}
function updatePalette(tex, rgColors) {
    // WebGL needs an unpacked array of RGB values
    var rgb = new Uint8Array(256 * 4);
    var ib = 0;
    for (var i = 0; i < 256; ++i) {
        var color = rgColors[i];
        rgb[ib++] = 4 * (color >> 16) & 0xff; // R
        rgb[ib++] = 4 * (color >> 8) & 0xff; // G
        rgb[ib++] = 4 * (color >> 0) & 0xff; // B
        rgb[ib++] = (i >= 254) ? 0 : 255; // A
    }
    // update the palette
    bindTexture(0, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgb);
    // gl.bindTexture(gl.TEXTURE_2D, null);
}
function createBuffer(rgItems, cValuesPerItem, flags) {
    if (!rgItems) {
        throw new Error("invalid item array");
    }
    var cItems = rgItems.length;
    if (!cItems || (cItems % cValuesPerItem) !== 0) {
        throw new Error("invalid #items");
    }
    if (flags == null) {
        flags = gl.STATIC_DRAW;
    }
    var items = new Float32Array(rgItems);
    var buffer = gl.createBuffer();
    if (!buffer) {
        throw new Error("failed to create buffer");
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, items, flags);
    buffer.itemSize = cValuesPerItem;
    buffer.numItems = cItems / cValuesPerItem;
    return buffer;
}
function createDynamicBuffer(rgItems, cValuesPerItem) {
    if (!rgItems) {
        throw new Error("invalid item array");
    }
    var cItems = rgItems.length;
    if (!cItems || (cItems % cValuesPerItem) !== 0) {
        throw new Error("invalid #items");
    }
    var items = new Float32Array(rgItems);
    var buffer = gl.createBuffer();
    if (!buffer) {
        throw new Error("failed to create buffer");
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, items, gl.DYNAMIC_DRAW);
    buffer.itemSize = cValuesPerItem;
    buffer.numItems = cItems / cValuesPerItem;
    buffer.items = items;
    return buffer;
}
function updateDynamicBuffer(buffer, offset, items) {
    if (!buffer) {
        throw new Error("buffer");
    }
    if (offset === undefined) {
        offset = 0;
    }
    if (!items) {
        throw new Error("invalid buffer items");
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, offset, items);
}
var _cHits = 0;
var _cCalls = 0;
var _mapAttribBuffers = [];
function loadAttribBuffer(attrib, buffer) {
    if (attrib === undefined) {
        throw new Error("invalid attibute");
    }
    if (!buffer) {
        throw new Error("invalid buffer");
    }
    if (_mapAttribBuffers[attrib] === buffer) {
        _cHits++;
        return;
    }
    _cCalls++;
    _mapAttribBuffers[attrib] = buffer;
    if (attrib === undefined) {
        throw new Error("invalid item array");
    }
    if (buffer === undefined) {
        throw new Error("invalid item array");
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(attrib, buffer.itemSize, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attrib);
}
function updateViewport() {
    if (!gl) {
        return;
    }
    var canvas = gl.canvas;
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    canvas.width = 800;
    canvas.height = 600;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, canvas.width, canvas.height);
    var FOV = 59;
    var matProjection = Mat4.createPerspective(FOV, width / height, .01, 5000).flatten();
    for (var i = rgPrograms.length; i--;) {
        var program = rgPrograms[i];
        gl.useProgram(program);
        gl.uniformMatrix4fv(program.matProjection, false, matProjection);
    }
    _programLast = rgPrograms[0];
}
var matModelView;
var rgMatrices = [];
function beginScene(position, orient) {
    var or4 = orient.toMat4();
    matModelView = or4.multiply(Mat4.createTranslation(Vec3.Zero.sub(position)));
    rgMatrices.length = 0;
    // updateMatModelView(matModelView);
    useProgram(programBillboardX);
    gl.uniform3f(programBillboardX.eye, position.x, position.y, position.z);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}
function createAngleMatrix(angles, pos) {
    var mat = pos ? Mat4.createTranslation(pos) : null;
    if (angles && angles !== Vec3.Zero) {
        var matOrient = Mat3.createRotation(angles).toMat4();
        if (mat) {
            mat = mat.multiply(matOrient);
        }
        else {
            mat = matOrient;
        }
    }
    return mat;
}
function pushInstanceMatrix(m) {
    if (!(m instanceof Mat4)) {
        throw new Error("invalid argument: m");
    }
    pushMatrix(matModelView.multiply(m));
}
function pushMatrix(m) {
    if (!(m instanceof Mat4)) {
        throw new Error("invalid argument: m");
    }
    rgMatrices.push(matModelView);
    updateMatModelView(m);
}
function pushAnglesMatrix(angles, pos) {
    if (!(angles instanceof Vec3)) {
        throw new Error("invalid argument: angles");
    }
    var matOrient = Mat3.fromEuler(angles.x, angles.y, angles.z);
    pushOrientMatrix(matOrient, pos);
}
function pushTranslateMatrix(pos) {
    if (!(pos instanceof Vec3)) {
        throw new Error("invalid argument: pos");
    }
    var matPos = Mat4.createTranslation(pos);
    pushInstanceMatrix(matPos);
}
function pushOrientMatrix(matOrient, pos) {
    if (!(matOrient instanceof Mat3)) {
        throw new Error("invalid argument: matOrient");
    }
    var mat = matOrient.transpose().toMat4();
    if (pos) {
        if (!(pos instanceof Vec3)) {
            throw new Error("invalid vector: pos");
        }
        var matPos = Mat4.createTranslation(pos);
        mat = matPos.multiply(mat);
    }
    pushInstanceMatrix(mat);
}
function popMatrix() {
    updateMatModelView(matModelView = notNull(rgMatrices.pop()));
    return matModelView;
}
var _programLast;
function useProgram(program) {
    if (_programLast === program) {
        return;
    }
    _programLast = program;
    gl.useProgram(program);
    _activeTexture = null;
    if (program.mmv !== matModelView) {
        program.mmv = matModelView;
        gl.uniformMatrix4fv(program.matModelView, false, matModelView.flatten());
    }
}
function updateMatModelView(m) {
    if (!m) {
        throw new Error("invalid matrix");
    }
    matModelView = m;
    if (_programLast) {
        _programLast.mmv = matModelView;
        gl.uniformMatrix4fv(_programLast.matModelView, false, matModelView.flatten());
    }
}
function webGLStart() {
    var canvas = $("#canvas")[0];
    gl = canvas.getContext("experimental-webgl");
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(0.0);
    gl.frontFace(gl.CW);
    gl.cullFace(gl.FRONT);
    gl.enable(gl.CULL_FACE);
    gl.depthFunc(gl.GEQUAL);
    gl.enable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return initShaders();
}
var _audio;
var _mainAudio;
var SoundFile = /** @class */ (function () {
    function SoundFile() {
    }
    SoundFile.prototype.load = function (stream) {
        this.name = stream.getString(8);
        this.length = stream.getUint32();
        this.data_length = stream.getUint32(); // ?
        this.offset = stream.getUint32();
        return this;
    };
    SoundFile.prototype.getBuffer = function () {
        var buffer = this.buffer;
        if (!buffer) {
            buffer = this.buffer = _audio.createBuffer(1, this.length, 22050 / 2);
            // buffer.gain.value = 1;
            var rgSamples = buffer.getChannelData(0);
            var data = this.data;
            for (var iSample = this.length; iSample--;) {
                // rgSamples[iSample] = data[iSample] * 2 / 255 - 1;
                rgSamples[iSample] = data[iSample] / 255 - .5;
            }
        }
        return buffer;
    };
    SoundFile.prototype.playObjectSound = function (obj) {
        if (!_audio) {
            return;
        }
        var buffer = this.getBuffer();
        var playingSound = new ItemSound(buffer, obj);
        PlayingSound.play(playingSound);
    };
    SoundFile.prototype.playSound = function (pos) {
        if (!_audio) {
            return;
        }
        var buffer = this.getBuffer();
        var playingSound = pos ? new PositionalSound(buffer, pos) : new PlayingSound(buffer);
        PlayingSound.play(playingSound);
    };
    return SoundFile;
}());
var SoundFile_Sounds;
(function (SoundFile_Sounds) {
    SoundFile_Sounds[SoundFile_Sounds["LASER_FIRED"] = 10] = "LASER_FIRED";
    SoundFile_Sounds[SoundFile_Sounds["WEAPON_HIT_DOOR"] = 27] = "WEAPON_HIT_DOOR";
    SoundFile_Sounds[SoundFile_Sounds["WEAPON_HIT_BLASTABLE"] = 11] = "WEAPON_HIT_BLASTABLE";
    SoundFile_Sounds[SoundFile_Sounds["BADASS_EXPLOSION"] = 11] = "BADASS_EXPLOSION";
    SoundFile_Sounds[SoundFile_Sounds["ROBOT_HIT_PLAYER"] = 17] = "ROBOT_HIT_PLAYER";
    SoundFile_Sounds[SoundFile_Sounds["ROBOT_HIT"] = 20] = "ROBOT_HIT";
    SoundFile_Sounds[SoundFile_Sounds["ROBOT_DESTROYED"] = 21] = "ROBOT_DESTROYED";
    SoundFile_Sounds[SoundFile_Sounds["VOLATILE_WALL_HIT"] = 21] = "VOLATILE_WALL_HIT";
    SoundFile_Sounds[SoundFile_Sounds["LASER_HIT_WATER"] = 232] = "LASER_HIT_WATER";
    SoundFile_Sounds[SoundFile_Sounds["MISSILE_HIT_WATER"] = 233] = "MISSILE_HIT_WATER";
    SoundFile_Sounds[SoundFile_Sounds["LASER_HIT_CLUTTER"] = 30] = "LASER_HIT_CLUTTER";
    SoundFile_Sounds[SoundFile_Sounds["CONTROL_CENTER_HIT"] = 30] = "CONTROL_CENTER_HIT";
    SoundFile_Sounds[SoundFile_Sounds["EXPLODING_WALL"] = 31] = "EXPLODING_WALL";
    SoundFile_Sounds[SoundFile_Sounds["CONTROL_CENTER_DESTROYED"] = 31] = "CONTROL_CENTER_DESTROYED";
    SoundFile_Sounds[SoundFile_Sounds["CONTROL_CENTER_WARNING_SIREN"] = 32] = "CONTROL_CENTER_WARNING_SIREN";
    SoundFile_Sounds[SoundFile_Sounds["MINE_BLEW_UP"] = 33] = "MINE_BLEW_UP";
    SoundFile_Sounds[SoundFile_Sounds["FUSION_WARMUP"] = 34] = "FUSION_WARMUP";
    SoundFile_Sounds[SoundFile_Sounds["DROP_WEAPON"] = 39] = "DROP_WEAPON";
    SoundFile_Sounds[SoundFile_Sounds["FORCEFIELD_BOUNCE_PLAYER"] = 40] = "FORCEFIELD_BOUNCE_PLAYER";
    SoundFile_Sounds[SoundFile_Sounds["FORCEFIELD_BOUNCE_WEAPON"] = 41] = "FORCEFIELD_BOUNCE_WEAPON";
    SoundFile_Sounds[SoundFile_Sounds["FORCEFIELD_HUM"] = 42] = "FORCEFIELD_HUM";
    SoundFile_Sounds[SoundFile_Sounds["FORCEFIELD_OFF"] = 43] = "FORCEFIELD_OFF";
    SoundFile_Sounds[SoundFile_Sounds["MARKER_HIT"] = 50] = "MARKER_HIT";
    SoundFile_Sounds[SoundFile_Sounds["BUDDY_MET_GOAL"] = 51] = "BUDDY_MET_GOAL";
    SoundFile_Sounds[SoundFile_Sounds["REFUEL_STATION_GIVING_FUEL"] = 62] = "REFUEL_STATION_GIVING_FUEL";
    SoundFile_Sounds[SoundFile_Sounds["PLAYER_HIT_WALL"] = 70] = "PLAYER_HIT_WALL";
    SoundFile_Sounds[SoundFile_Sounds["PLAYER_GOT_HIT"] = 71] = "PLAYER_GOT_HIT";
    SoundFile_Sounds[SoundFile_Sounds["HOSTAGE_RESCUED"] = 91] = "HOSTAGE_RESCUED";
    SoundFile_Sounds[SoundFile_Sounds["BRIEFING_HUM"] = 94] = "BRIEFING_HUM";
    SoundFile_Sounds[SoundFile_Sounds["BRIEFING_PRINTING"] = 95] = "BRIEFING_PRINTING";
    SoundFile_Sounds[SoundFile_Sounds["COUNTDOWN_0_SECS"] = 100] = "COUNTDOWN_0_SECS";
    SoundFile_Sounds[SoundFile_Sounds["COUNTDOWN_13_SECS"] = 113] = "COUNTDOWN_13_SECS";
    SoundFile_Sounds[SoundFile_Sounds["COUNTDOWN_29_SECS"] = 114] = "COUNTDOWN_29_SECS";
    SoundFile_Sounds[SoundFile_Sounds["HUD_MESSAGE"] = 117] = "HUD_MESSAGE";
    SoundFile_Sounds[SoundFile_Sounds["HUD_KILL"] = 118] = "HUD_KILL";
    SoundFile_Sounds[SoundFile_Sounds["HOMING_WARNING"] = 122] = "HOMING_WARNING";
    SoundFile_Sounds[SoundFile_Sounds["HUD_JOIN_REQUEST"] = 123] = "HUD_JOIN_REQUEST";
    SoundFile_Sounds[SoundFile_Sounds["HUD_BLUE_GOT_FLAG"] = 124] = "HUD_BLUE_GOT_FLAG";
    SoundFile_Sounds[SoundFile_Sounds["HUD_RED_GOT_FLAG"] = 125] = "HUD_RED_GOT_FLAG";
    SoundFile_Sounds[SoundFile_Sounds["HUD_YOU_GOT_FLAG"] = 126] = "HUD_YOU_GOT_FLAG";
    SoundFile_Sounds[SoundFile_Sounds["HUD_BLUE_GOT_GOAL"] = 127] = "HUD_BLUE_GOT_GOAL";
    SoundFile_Sounds[SoundFile_Sounds["HUD_RED_GOT_GOAL"] = 128] = "HUD_RED_GOT_GOAL";
    SoundFile_Sounds[SoundFile_Sounds["HUD_YOU_GOT_GOAL"] = 129] = "HUD_YOU_GOT_GOAL";
    SoundFile_Sounds[SoundFile_Sounds["LAVAFALL_HISS"] = 150] = "LAVAFALL_HISS";
    SoundFile_Sounds[SoundFile_Sounds["VOLATILE_WALL_HISS"] = 151] = "VOLATILE_WALL_HISS";
    SoundFile_Sounds[SoundFile_Sounds["SHIP_IN_WATER"] = 152] = "SHIP_IN_WATER";
    SoundFile_Sounds[SoundFile_Sounds["SHIP_IN_WATERFALL"] = 158] = "SHIP_IN_WATERFALL";
    SoundFile_Sounds[SoundFile_Sounds["GOOD_SELECTION_PRIMARY"] = 153] = "GOOD_SELECTION_PRIMARY";
    SoundFile_Sounds[SoundFile_Sounds["BAD_SELECTION"] = 156] = "BAD_SELECTION";
    SoundFile_Sounds[SoundFile_Sounds["GOOD_SELECTION_SECONDARY"] = 154] = "GOOD_SELECTION_SECONDARY";
    SoundFile_Sounds[SoundFile_Sounds["ALREADY_SELECTED"] = 155] = "ALREADY_SELECTED";
    SoundFile_Sounds[SoundFile_Sounds["CLOAK_ON"] = 160] = "CLOAK_ON";
    SoundFile_Sounds[SoundFile_Sounds["CLOAK_OFF"] = 161] = "CLOAK_OFF";
    SoundFile_Sounds[SoundFile_Sounds["INVULNERABILITY_OFF"] = 163] = "INVULNERABILITY_OFF";
    SoundFile_Sounds[SoundFile_Sounds["BOSS_SHARE_SEE"] = 183] = "BOSS_SHARE_SEE";
    SoundFile_Sounds[SoundFile_Sounds["BOSS_SHARE_DIE"] = 185] = "BOSS_SHARE_DIE";
    SoundFile_Sounds[SoundFile_Sounds["SEE_SOUND_DEFAULT"] = 170] = "SEE_SOUND_DEFAULT";
    SoundFile_Sounds[SoundFile_Sounds["ATTACK_SOUND_DEFAULT"] = 171] = "ATTACK_SOUND_DEFAULT";
    SoundFile_Sounds[SoundFile_Sounds["CLAW_SOUND_DEFAULT"] = 190] = "CLAW_SOUND_DEFAULT";
    SoundFile_Sounds[SoundFile_Sounds["DROP_BOMB"] = 26] = "DROP_BOMB";
    SoundFile_Sounds[SoundFile_Sounds["CHEATER"] = 200] = "CHEATER";
    SoundFile_Sounds[SoundFile_Sounds["AMBIENT_LAVA"] = 222] = "AMBIENT_LAVA";
    SoundFile_Sounds[SoundFile_Sounds["AMBIENT_WATER"] = 223] = "AMBIENT_WATER";
    SoundFile_Sounds[SoundFile_Sounds["CONVERT_ENERGY"] = 241] = "CONVERT_ENERGY";
    SoundFile_Sounds[SoundFile_Sounds["WEAPON_STOLEN"] = 244] = "WEAPON_STOLEN";
    SoundFile_Sounds[SoundFile_Sounds["LIGHT_BLOWNUP"] = 157] = "LIGHT_BLOWNUP";
    SoundFile_Sounds[SoundFile_Sounds["WALL_REMOVED"] = 246] = "WALL_REMOVED";
    SoundFile_Sounds[SoundFile_Sounds["AFTERBURNER_IGNITE"] = 247] = "AFTERBURNER_IGNITE";
    SoundFile_Sounds[SoundFile_Sounds["AFTERBURNER_PLAY"] = 248] = "AFTERBURNER_PLAY";
    SoundFile_Sounds[SoundFile_Sounds["SECRET_EXIT"] = 249] = "SECRET_EXIT";
    SoundFile_Sounds[SoundFile_Sounds["SEISMIC_DISTURBANCE_START"] = 251] = "SEISMIC_DISTURBANCE_START";
    SoundFile_Sounds[SoundFile_Sounds["YOU_GOT_ORB"] = 84] = "YOU_GOT_ORB";
    SoundFile_Sounds[SoundFile_Sounds["FRIEND_GOT_ORB"] = 85] = "FRIEND_GOT_ORB";
    SoundFile_Sounds[SoundFile_Sounds["OPPONENT_GOT_ORB"] = 86] = "OPPONENT_GOT_ORB";
    SoundFile_Sounds[SoundFile_Sounds["OPPONENT_HAS_SCORED"] = 87] = "OPPONENT_HAS_SCORED";
    SoundFile_Sounds[SoundFile_Sounds["BIG_ENDLEVEL_EXPLOSION"] = 31] = "BIG_ENDLEVEL_EXPLOSION";
    SoundFile_Sounds[SoundFile_Sounds["TUNNEL_EXPLOSION"] = 31] = "TUNNEL_EXPLOSION";
    SoundFile_Sounds[SoundFile_Sounds["ROBOT_SUCKED_PLAYER"] = 17] = "ROBOT_SUCKED_PLAYER";
    SoundFile_Sounds[SoundFile_Sounds["WALL_CLOAK_ON"] = 160] = "WALL_CLOAK_ON";
    SoundFile_Sounds[SoundFile_Sounds["WALL_CLOAK_OFF"] = 161] = "WALL_CLOAK_OFF";
})(SoundFile_Sounds || (SoundFile_Sounds = {}));
// SoundFile_Sounds = freeze(SoundFile_Sounds);
var PlayingSound = /** @class */ (function () {
    function PlayingSound(buffer) {
        this.buffer = buffer;
    }
    PlayingSound.play = function (sound) {
        PlayingSound.rgPlayingSounds.push(sound);
        sound.play();
    };
    PlayingSound.update = function () {
        var rgPlayingSounds = PlayingSound.rgPlayingSounds;
        for (var iPlayingSound = rgPlayingSounds.length; iPlayingSound--;) {
            var playingSound = rgPlayingSounds[iPlayingSound];
            if (!playingSound.update()) {
                rgPlayingSounds.swapOut(iPlayingSound);
            }
        }
    };
    PlayingSound.prototype.play = function () {
        this.createSourceNode(this.buffer);
        this.update();
        this.sourceNode.start(0);
    };
    PlayingSound.prototype.createSourceNode = function (buffer) {
        var sourceNode = this.sourceNode = _audio.createBufferSource();
        sourceNode.buffer = buffer;
        // sourceNode.playbackRate.value = .5;
        sourceNode.connect(_mainAudio);
    };
    PlayingSound.prototype.update = function () {
        // do nothing
    };
    PlayingSound.rgPlayingSounds = [];
    return PlayingSound;
}());
var PannerSound = /** @class */ (function (_super) {
    __extends(PannerSound, _super);
    function PannerSound() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PannerSound.prototype.createSourceNode = function (buffer) {
        var sourceNode = this.sourceNode = _audio.createBufferSource();
        sourceNode.buffer = buffer;
        // sourceNode.playbackRate.value = .5;
        var pannerNode = this.pannerNode = _audio.createPanner();
        pannerNode.panningModel = "equalpower";
        pannerNode.distanceModel = "inverse";
        pannerNode.refDistance = 2;
        pannerNode.rolloffFactor = .5;
        sourceNode.connect(pannerNode);
        pannerNode.connect(_mainAudio);
    };
    return PannerSound;
}(PlayingSound));
var PositionalSound = /** @class */ (function (_super) {
    __extends(PositionalSound, _super);
    function PositionalSound(buffer, pos) {
        var _this = _super.call(this, buffer) || this;
        _this.pos = pos;
        notNull(_this.pos);
        return _this;
    }
    PositionalSound.prototype.update = function () {
        var pos = this.pos;
        this.pannerNode.setPosition(pos.x, pos.y, pos.z);
        return this.sourceNode.playbackState !== this.sourceNode.FINISHED_STATE;
    };
    return PositionalSound;
}(PannerSound));
var ItemSound = /** @class */ (function (_super) {
    __extends(ItemSound, _super);
    function ItemSound(buffer, obj) {
        var _this = _super.call(this, buffer) || this;
        _this.obj = obj;
        notNull(_this.obj);
        return _this;
    }
    ItemSound.prototype.update = function () {
        var obj = this.obj;
        var pos = obj.pos;
        this.pannerNode.setPosition(pos.x, pos.y, pos.z);
        /*
        const pi = obj.mover;
        if (pi) {
            const vel = pi.velocity;
            // this.pannerNode.setVelocity(vel.x, vel.y, vel.z);
            this.pannerNode.setVelocity(0, 0, 0);
        }
        */
        return this.sourceNode.playbackState !== this.sourceNode.FINISHED_STATE;
    };
    return ItemSound;
}(PannerSound));
var _pig;
var BitmapFlags;
(function (BitmapFlags) {
    BitmapFlags[BitmapFlags["TRANSPARENT"] = 1] = "TRANSPARENT";
    BitmapFlags[BitmapFlags["SUPER_TRANSPARENT"] = 2] = "SUPER_TRANSPARENT";
    BitmapFlags[BitmapFlags["NO_LIGHTING"] = 4] = "NO_LIGHTING";
    BitmapFlags[BitmapFlags["RLE"] = 8] = "RLE";
    BitmapFlags[BitmapFlags["PAGED_OUT"] = 16] = "PAGED_OUT";
    BitmapFlags[BitmapFlags["RLE_BIG"] = 32] = "RLE_BIG";
})(BitmapFlags || (BitmapFlags = {}));
var BitmapHeader = /** @class */ (function () {
    function BitmapHeader() {
    }
    BitmapHeader.prototype.load = function (stream) {
        this.buffer = stream.view.buffer;
        this.name = stream.getTerminatedString(["\0", "\n"], 8);
        var dflags = stream.getUint8();
        this.width = stream.getUint8();
        this.height = stream.getUint8();
        var wh_extra = stream.getUint8();
        this.flags = stream.getUint8();
        this.avg_color = stream.getUint8();
        this.offset = stream.getUint32();
        if (dflags & (1 << 6)) {
            this.name += "#" + (dflags & ((1 << 6) - 1));
        }
        this.width += (wh_extra & 0x0f) << 8;
        this.height += (wh_extra & 0xf0) << 4;
        return this;
    };
    BitmapHeader.prototype.isTransparent = function () {
        return this.flags & BitmapFlags.TRANSPARENT;
    };
    BitmapHeader.prototype.loadImage = function () {
        if (!this.data) {
            var view = new DataView(this.buffer, this.offset);
            var stream = new DataStream(view);
            if (this.flags & BitmapFlags.RLE) {
                var cbTotal = stream.getUint32();
                var offset = stream.position;
                var rgSizes = void 0;
                if (this.flags & BitmapFlags.RLE_BIG) {
                    rgSizes = stream.getUint16Array(this.height);
                }
                else {
                    rgSizes = stream.getUint8Array(this.height);
                }
                var offsetData = stream.position;
                var cbData = 0;
                var rgPixels = [];
                for (var y = 0; y < this.height; ++y) {
                    if (rgPixels.length !== this.width * y) {
                        throw new Error("corrupt image data");
                    }
                    for (var data = stream.getUint8(); data !== 0xe0; data = stream.getUint8()) {
                        if ((data & 0xe0) === 0xe0) {
                            var count = data & ~0xe0;
                            data = stream.getUint8();
                            while (count--) {
                                rgPixels.push(data);
                            }
                        }
                        else {
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
            }
            else {
                this.data = new Uint8Array(stream.view.buffer, stream.view.byteOffset + stream.position, this.width * this.height);
            }
        }
        return this.data;
    };
    BitmapHeader.prototype.getPixel = function (x, y) {
        x = Math.mod(x, this.width);
        y = Math.mod(y, this.height);
        var data = this.loadImage();
        return this.data[x + y * this.width];
    };
    return BitmapHeader;
}());
var Texture = /** @class */ (function () {
    function Texture(tex, bmp) {
        this.tex = tex;
        this.bmp = bmp;
        // do nothing
    }
    return Texture;
}());
var TMapInfoFlags;
(function (TMapInfoFlags) {
    TMapInfoFlags[TMapInfoFlags["VOLATILE"] = 1] = "VOLATILE";
    TMapInfoFlags[TMapInfoFlags["WATER"] = 2] = "WATER";
    TMapInfoFlags[TMapInfoFlags["FORCE_FIELD"] = 4] = "FORCE_FIELD";
    TMapInfoFlags[TMapInfoFlags["GOAL_BLUE"] = 8] = "GOAL_BLUE";
    TMapInfoFlags[TMapInfoFlags["GOAL_RED"] = 16] = "GOAL_RED";
    TMapInfoFlags[TMapInfoFlags["GOAL_HOARD"] = 32] = "GOAL_HOARD";
})(TMapInfoFlags || (TMapInfoFlags = {}));
var TMapInfo = /** @class */ (function () {
    function TMapInfo() {
    }
    TMapInfo.prototype.load = function (stream) {
        this.flags = stream.getUint8();
        stream.position += 3;
        this.lighting = stream.getFixed();
        this.damage = stream.getFixed();
        this.eclip_num = stream.getInt16();
        this.destroyed = stream.getInt16();
        this.slide_u = stream.getFixed2();
        this.slide_v = stream.getFixed2();
        return this;
    };
    TMapInfo.prototype.loadTexture = function (iUnit) {
        return _pig.loadBitmap(this.textureIndex, iUnit);
    };
    TMapInfo.prototype.getBitmapAsset = function () {
        return _pig.getAsset(this.textureIndex);
    };
    TMapInfo.prototype.isTransparent = function () {
        var asset = this.getBitmapAsset();
        return asset.isTransparent();
    };
    TMapInfo.prototype.getPixel = function (u, v) {
        var bmp = this.getBitmapAsset();
        return bmp.getPixel(Math.floor(u * bmp.width), Math.floor(v * bmp.height));
    };
    return TMapInfo;
}());
function isPowerOf2(x) { return 0 === (x & (x - 1)); }
var Pig = /** @class */ (function () {
    function Pig() {
        // mapAssetByName: object;
        this.rgLoadedTextures = [];
    }
    Pig.prototype.load = function (view) {
        var pig = new DataStream(view);
        var id = pig.getString(4);
        var version = pig.getUint32();
        if (id !== "PPIG" || version !== 2) {
            throw new Error("invalid PIG version: " + id + "/" + version);
        }
        var cBitmaps = pig.getUint32();
        var rgBitmaps = Array_iterate(cBitmaps, function () { return new BitmapHeader().load(pig); });
        var dataStart = pig.position;
        var mapAssetsByName = {};
        for (var iBitmap = 0; iBitmap < cBitmaps; ++iBitmap) {
            var bitmap = rgBitmaps[iBitmap];
            mapAssetsByName[bitmap.name] = bitmap;
            bitmap.offset += dataStart;
        }
        this.assets = rgBitmaps;
        // this.mapAssetsByName = mapAssetsByName;
        return this;
    };
    Pig.prototype.getAsset = function (index) {
        index--;
        if (index < 0 || index >= this.assets.length) {
            throw new Error("bitmap index out of range: " + index);
        }
        return this.assets[index];
    };
    Pig.prototype.loadBitmap = function (iBitmap, iUnit) {
        if (iBitmap === 0) {
            throw new Error("missing bitmap" + iBitmap);
        }
        var texture = this.rgLoadedTextures[iBitmap];
        if (!texture) {
            var bmp = this.getAsset(iBitmap);
            var tex = createTexture(iUnit);
            texture = this.rgLoadedTextures[iBitmap] = new Texture(tex, bmp);
            if (isPowerOf2(bmp.width) && isPowerOf2(bmp.height)) {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            }
            else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            }
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, bmp.width, bmp.height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bmp.loadImage());
            // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, bmp.width, bmp.height, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
        }
        return texture;
    };
    return Pig;
}());
var VCLIP_MAX_FRAMES = 30;
var VClipFlags;
(function (VClipFlags) {
    VClipFlags[VClipFlags["ROD"] = 1] = "ROD";
})(VClipFlags || (VClipFlags = {}));
var VClip = /** @class */ (function () {
    function VClip() {
    }
    VClip.prototype.load = function (stream) {
        this.play_time = stream.getFixed();
        this.num_frames = stream.getInt32();
        this.frame_time = stream.getFixed();
        this.flags = stream.getInt32();
        this.sound_num = stream.getInt16();
        this.frames = stream.getInt16Array(VCLIP_MAX_FRAMES);
        this.light_value = stream.getFixed();
        return this;
    };
    return VClip;
}());
var KnownVClips;
(function (KnownVClips) {
    KnownVClips[KnownVClips["SMALL_EXPLOSION"] = 2] = "SMALL_EXPLOSION";
    KnownVClips[KnownVClips["PLAYER_HIT"] = 1] = "PLAYER_HIT";
    KnownVClips[KnownVClips["MORPHING_ROBOT"] = 10] = "MORPHING_ROBOT";
    KnownVClips[KnownVClips["PLAYER_APPEARANCE"] = 61] = "PLAYER_APPEARANCE";
    KnownVClips[KnownVClips["POWERUP_DISAPPEARANCE"] = 62] = "POWERUP_DISAPPEARANCE";
    KnownVClips[KnownVClips["VOLATILE_WALL_HIT"] = 5] = "VOLATILE_WALL_HIT";
    KnownVClips[KnownVClips["WATER_HIT"] = 84] = "WATER_HIT";
    KnownVClips[KnownVClips["AFTERBURNER_BLOB"] = 95] = "AFTERBURNER_BLOB";
    KnownVClips[KnownVClips["MONITOR_STATIC"] = 99] = "MONITOR_STATIC";
    KnownVClips[KnownVClips["HOSTAGE"] = 33] = "HOSTAGE";
})(KnownVClips || (KnownVClips = {}));
var EClipFlags;
(function (EClipFlags) {
    EClipFlags[EClipFlags["CRITICAL"] = 1] = "CRITICAL";
    EClipFlags[EClipFlags["ONE_SHOT"] = 2] = "ONE_SHOT";
    EClipFlags[EClipFlags["STOPPED"] = 4] = "STOPPED";
})(EClipFlags || (EClipFlags = {}));
var EClip = /** @class */ (function (_super) {
    __extends(EClip, _super);
    function EClip() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    EClip.prototype.load = function (stream) {
        _super.prototype.load.call(this, stream); // VClip
        this.time_left = stream.getFixed(); /*for sequencing */
        this.frame_count = stream.getInt32(); /*for sequencing */
        this.changing_wall_texture = stream.getInt16(); /*Which element of Textures array to */
        this.changing_object_texture = stream.getInt16(); /*Which element of ObjBitmapPtrs array */
        this.eflags = stream.getInt32();
        this.crit_clip = stream.getInt32(); /*use this clip instead of above one */
        this.dest_bm_num = stream.getInt32(); /*use this bitmap when monitor destroyed */
        this.dest_vclip = stream.getInt32(); /*what vclip to play when exploding */
        this.dest_eclip = stream.getInt32(); /*what eclip to play when exploding */
        this.dest_size = stream.getFixed(); /*3d size of explosion */
        this.sound_num = stream.getInt32(); /*what sound this makes */
        this.segnum = stream.getInt32(); /*what seg & side, for one-shot clips */
        this.sidenum = stream.getInt32();
        return this;
    };
    Object.defineProperty(EClip.prototype, "flagsQ", {
        get: function () { return this.eflags; },
        enumerable: true,
        configurable: true
    });
    EClip.prototype.update = function (frameTime) {
        if (this.eflags & EClipFlags.STOPPED) {
            return;
        }
        if (this.changing_wall_texture === -1 && this.changing_object_texture === -1) {
            return;
        }
        this.time_left -= frameTime;
        while (this.time_left < 0) {
            this.time_left += this.frame_time;
            this.frame_count++;
            if (this.frame_count >= this.num_frames) {
                if (this.eflags & EClipFlags.ONE_SHOT) {
                    _level.getSide(this.segnum, this.sidenum).setTex2(this.dest_bm_num);
                    this.eflags = this.eflags & ~EClipFlags.ONE_SHOT | EClipFlags.STOPPED;
                    this.segnum = -1;
                }
                this.frame_count = 0;
            }
        }
        if (this.eflags & EClipFlags.CRITICAL) {
            return;
        }
        // TODO: control center destroyed
        if (this.changing_wall_texture !== -1) {
            // const asset = _pig.getAsset(this.frames[this.frame_count] + 1);
            // console.log(this.changing_wall_texture, asset.name);
            var tmi = _ham.rgTMapInfos[this.changing_wall_texture];
            tmi.textureIndex = this.frames[this.frame_count];
        }
    };
    return EClip;
}(VClip));
var MAX_CLIP_FRAMES = 50;
var WClipFlags;
(function (WClipFlags) {
    WClipFlags[WClipFlags["EXPLODES"] = 1] = "EXPLODES";
    WClipFlags[WClipFlags["BLASTABLE"] = 2] = "BLASTABLE";
    WClipFlags[WClipFlags["TMAP1"] = 4] = "TMAP1";
    WClipFlags[WClipFlags["HIDDEN"] = 8] = "HIDDEN";
})(WClipFlags || (WClipFlags = {}));
var WClip = /** @class */ (function () {
    function WClip() {
    }
    WClip.prototype.load = function (stream) {
        this.play_time = stream.getFixed();
        this.num_frames = stream.getInt16();
        this.frames = stream.getInt16Array(MAX_CLIP_FRAMES);
        this.open_sound = stream.getInt16();
        this.close_sound = stream.getInt16();
        this.flags = stream.getInt16();
        this.filename = stream.getTerminatedString(["\0", "\n"], 13);
        stream.position++;
        return this;
    };
    WClip.prototype.apply = function (side, iFrame) {
        /*
        const cFrames = this.num_frames;
        const iFrame = Math.floor (cFrames * time / this.play_time);
        if (iFrame >= cFrames)
            iFrame = cFrames - 1;
        */
        var tex = this.frames[iFrame];
        var otherSide = side.otherSide;
        if (this.flags & WClipFlags.TMAP1) {
            side.setTex1(tex);
            if (otherSide) {
                otherSide.setTex1(tex);
            }
        }
        else {
            side.setTex2(tex, false);
            if (otherSide) {
                otherSide.setTex2(tex, false);
            }
        }
    };
    return WClip;
}());
var JointList = /** @class */ (function () {
    function JointList() {
    }
    JointList.prototype.load = function (stream) {
        this.n_joints = stream.getInt16();
        this.offset = stream.getInt16();
        return this;
    };
    return JointList;
}());
var MAX_GUNS = 8;
var NDL = 5; // # difficulty levels
var N_ANIM_STATES = 5; // # difficulty levels
var RobotType = /** @class */ (function () {
    function RobotType() {
    }
    RobotType.prototype.load = function (stream) {
        this.model_num = stream.getInt32();
        this.gun_points = stream.getVectorArray(MAX_GUNS);
        this.gun_submodels = stream.getUint8Array(MAX_GUNS);
        this.exp1_vclip_num = stream.getInt16();
        this.exp1_sound_num = stream.getInt16();
        // if (this.exp1_vclip_num !== -1)
        // 	$this.rgVClips.checkIndex(this.exp1_vclip_num);
        // console.assert(this.exp1_sound_num === -1 || this.exp1_sound_num >= 0 && this.exp1_sound_num < $this.cSounds);
        this.exp2_vclip_num = stream.getInt16();
        this.exp2_sound_num = stream.getInt16();
        // if (this.exp2_vclip_num !== -1)
        // 	$this.rgVClips.checkIndex(this.exp2_vclip_num);
        // console.assert(this.exp2_sound_num === -1 || this.exp2_sound_num >= 0 && this.exp2_sound_num < $this.cSounds);
        this.weapon_type = stream.getUint8();
        this.weapon_type2 = stream.getUint8();
        this.n_guns = stream.getUint8();
        this.contains_id = stream.getUint8();
        this.contains_count = stream.getUint8();
        this.contains_prob = stream.getUint8();
        this.contains_type = stream.getUint8();
        this.kamikaze = stream.getUint8();
        this.score_value = stream.getInt16();
        this.badass = stream.getUint8();
        this.energy_drain = stream.getUint8();
        this.lighting = stream.getFixed();
        this.strength = stream.getFixed();
        this.mass = stream.getFixed();
        this.drag = stream.getFixed();
        this.field_of_view = stream.getFixedArray(NDL);
        this.firing_wait = stream.getFixedArray(NDL);
        this.firing_wait2 = stream.getFixedArray(NDL);
        this.turn_time = stream.getFixedArray(NDL);
        this.max_speed = stream.getFixedArray(NDL);
        this.circle_distance = stream.getFixedArray(NDL);
        this.rapidfire_count = stream.getUint8Array(NDL);
        this.evade_speed = stream.getUint8Array(NDL);
        this.cloak_type = stream.getUint8();
        this.attack_type = stream.getUint8();
        this.see_sound = stream.getUint8();
        this.attack_sound = stream.getUint8();
        this.claw_sound = stream.getUint8();
        this.taunt_sound = stream.getUint8();
        this.boss_flag = stream.getUint8();
        this.companion = stream.getUint8();
        this.smart_blobs = stream.getUint8();
        this.energy_blobs = stream.getUint8();
        this.thief = stream.getUint8();
        this.pursuit = stream.getUint8();
        this.lightcast = stream.getUint8();
        this.death_roll = stream.getUint8();
        this.flags = stream.getUint8();
        stream.position += 3;
        this.deathroll_sound = stream.getUint8();
        this.glow = stream.getUint8();
        this.behavior = stream.getUint8();
        this.aim = stream.getUint8();
        this.anim_states = Array_iterate(MAX_GUNS + 1, function () {
            return Array_iterate(N_ANIM_STATES, function () { return new JointList().load(stream); });
        });
        var always_0xabcd = stream.getUint32();
        // if (always_0xabcd !== 0xabcd)
        // 	throw new Error("corrupted file");
        return this;
    };
    return RobotType;
}());
var RobotJoint = /** @class */ (function () {
    function RobotJoint() {
    }
    RobotJoint.prototype.load = function (stream) {
        this.jointnum = stream.getInt16();
        this.angles = stream.getVector2();
        return this;
    };
    return RobotJoint;
}());
var Ham = /** @class */ (function () {
    function Ham() {
    }
    Ham.prototype.load = function (view) {
        var stream = new DataStream(view);
        var sig = stream.getString(4);
        if (sig !== "HAM!") {
            throw new Error("invalid HAM signature: " + sig);
        }
        var version = stream.getUint32();
        if (version < 1 || version > 2) {
            throw new Error("unsupported HAM version: " + version);
        }
        var sound_offset = 0;
        if (version < 3) {
            sound_offset = stream.getUint32();
        }
        var cTextures = stream.getUint32();
        var textureIndices = this.textureIndices = stream.getInt16Array(cTextures);
        this.rgTMapInfos = Array_iterate(cTextures, function (iTexture) {
            var tmi = new TMapInfo().load(stream);
            tmi.textureIndex = textureIndices[iTexture];
            return tmi;
        });
        /*
        const rgTMapInfos = [];
        this.textureIndices.forEach((i) => { rgTMapInfos[i] = new TMapInfo().load(stream); });
        this.rgTMapInfos = rgTMapInfos;
        */
        var cSounds = stream.getUint32();
        this.rgSounds = stream.getUint8Array(cSounds);
        var rgAltSounds = stream.getUint8Array(cSounds);
        var $this = this;
        var cVClips = stream.getUint32();
        this.rgVClips = Array_iterate(cVClips, function () { return new VClip().load(stream); });
        this.rgVClips[KnownVClips.HOSTAGE].flags |= VClipFlags.ROD;
        var cEClips = stream.getUint32();
        this.rgEClips = Array_iterate(cEClips, function () { return new EClip().load(stream); });
        var cWClips = stream.getUint32();
        this.rgWClips = Array_iterate(cWClips, function () { return new WClip().load(stream); });
        var cRobotTypes = stream.getUint32();
        this.rgRobotTypes = Array_iterate(cRobotTypes, function () { return new RobotType().load(stream); });
        var cRobotJoints = stream.getUint32();
        var rgRobotJoints = Array_iterate(cRobotJoints, function () { return new RobotJoint().load(stream); });
        var cWeaponInfos = stream.getUint32();
        this.rgWeaponInfos = Array_iterate(cWeaponInfos, function (iWeapon) { return new WeaponInfo().load(stream, version, iWeapon); });
        var cPowerupInfos = stream.getUint32();
        this.rgPowerupInfos = Array_iterate(cPowerupInfos, function () { return new PowerupInfo().load(stream); });
        var cPolygonModels = stream.getUint32();
        this.rgPolygonModels = Array_iterate(cPolygonModels, function () { return new PolygonModel().load(stream); });
        for (var iPolygonModel = 0; iPolygonModel < cPolygonModels; ++iPolygonModel) {
            this.rgPolygonModels[iPolygonModel].loadData(stream);
        }
        for (var iPolygonModel = 0; iPolygonModel < cPolygonModels; ++iPolygonModel) {
            this.rgPolygonModels[iPolygonModel].Dying_modelnum = stream.getInt32();
        }
        for (var iPolygonModel = 0; iPolygonModel < cPolygonModels; ++iPolygonModel) {
            this.rgPolygonModels[iPolygonModel].Dead_modelnum = stream.getInt32();
        }
        var cGuages = stream.getInt32();
        var rgGuages = stream.getInt16Array(cGuages);
        var rgGuagesHiRes = stream.getInt16Array(cGuages);
        var cObjBitmaps = stream.getInt32();
        this.rgObjBitmaps = stream.getInt16Array(cObjBitmaps);
        this.rgObjBitmapPtrs = stream.getInt16Array(cObjBitmaps);
        this.ship = new PlayerShip().load(stream);
        // cockpits
        // reactors
        // exit model
        if (version < 3) {
            stream.position = sound_offset;
            var cSounds_1 = stream.getUint32();
            this.rgSoundFiles = Array_iterate(cSounds_1, function () { return new SoundFile().load(stream); });
            var sound_start = stream.position;
            for (var iSound = this.rgSoundFiles.length; iSound--;) {
                var sf = this.rgSoundFiles[iSound];
                sf.index = iSound;
                var ibStart = sound_start + sf.offset;
                sf.data = new Uint8Array(view, ibStart, sf.length);
            }
        }
        return this;
    };
    Ham.prototype.playObjectSound = function (iSound, obj) {
        var iSoundFile = this.rgSounds[iSound];
        var sf = this.rgSoundFiles[iSoundFile];
        if (sf) {
            return sf.playObjectSound(obj);
        }
    };
    Ham.prototype.playSound = function (iSound, pos) {
        var iSoundFile = this.rgSounds[iSound];
        var sf = this.rgSoundFiles[iSoundFile];
        if (sf) {
            return sf.playSound(pos);
        }
    };
    Ham.prototype.updateEffects = function (frameTime) {
        var rgEffects = this.rgEClips;
        for (var iEffect = rgEffects.length; iEffect--;) {
            var effect = rgEffects[iEffect];
            effect.update(frameTime);
        }
    };
    return Ham;
}());
var MAX_LASER_LEVEL = 3; // Note, laser levels are numbered from 0.
var MAX_SUPER_LASER_LEVEL = 5; // Note, laser levels are numbered from 0.
var WeaponTypes;
(function (WeaponTypes) {
    WeaponTypes[WeaponTypes["LASER"] = 0] = "LASER";
    WeaponTypes[WeaponTypes["CONCUSSION"] = 8] = "CONCUSSION";
    WeaponTypes[WeaponTypes["FLARE"] = 9] = "FLARE";
    WeaponTypes[WeaponTypes["VULCAN"] = 11] = "VULCAN";
    WeaponTypes[WeaponTypes["SPREADFIRE"] = 12] = "SPREADFIRE";
    WeaponTypes[WeaponTypes["PLASMA"] = 13] = "PLASMA";
    WeaponTypes[WeaponTypes["FUSION"] = 14] = "FUSION";
    WeaponTypes[WeaponTypes["HOMING"] = 15] = "HOMING";
    WeaponTypes[WeaponTypes["PROXIMITY"] = 16] = "PROXIMITY";
    WeaponTypes[WeaponTypes["SMART"] = 17] = "SMART";
    WeaponTypes[WeaponTypes["MEGA"] = 18] = "MEGA";
    WeaponTypes[WeaponTypes["PLAYER_SMART_HOMING"] = 19] = "PLAYER_SMART_HOMING";
    WeaponTypes[WeaponTypes["SUPER_MECH_MISS"] = 21] = "SUPER_MECH_MISS";
    WeaponTypes[WeaponTypes["REGULAR_MECH_MISS"] = 22] = "REGULAR_MECH_MISS";
    WeaponTypes[WeaponTypes["SILENT_SPREADFIRE"] = 23] = "SILENT_SPREADFIRE";
    WeaponTypes[WeaponTypes["ROBOT_SMART_HOMING"] = 29] = "ROBOT_SMART_HOMING";
    WeaponTypes[WeaponTypes["EARTHSHAKER_MEGA"] = 54] = "EARTHSHAKER_MEGA";
    WeaponTypes[WeaponTypes["SUPER_LASER"] = 30] = "SUPER_LASER";
    WeaponTypes[WeaponTypes["GAUSS"] = 32] = "GAUSS";
    WeaponTypes[WeaponTypes["HELIX"] = 33] = "HELIX";
    WeaponTypes[WeaponTypes["PHOENIX"] = 34] = "PHOENIX";
    WeaponTypes[WeaponTypes["OMEGA"] = 35] = "OMEGA";
    WeaponTypes[WeaponTypes["FLASH"] = 36] = "FLASH";
    WeaponTypes[WeaponTypes["GUIDEDMISS"] = 37] = "GUIDEDMISS";
    WeaponTypes[WeaponTypes["SUPERPROX"] = 38] = "SUPERPROX";
    WeaponTypes[WeaponTypes["MERCURY"] = 39] = "MERCURY";
    WeaponTypes[WeaponTypes["EARTHSHAKER"] = 40] = "EARTHSHAKER";
    WeaponTypes[WeaponTypes["SMART_MINE_HOMING"] = 47] = "SMART_MINE_HOMING";
    WeaponTypes[WeaponTypes["ROBOT_SMART_MINE_HOMING"] = 49] = "ROBOT_SMART_MINE_HOMING";
    WeaponTypes[WeaponTypes["ROBOT_SUPERPROX"] = 53] = "ROBOT_SUPERPROX";
    WeaponTypes[WeaponTypes["ROBOT_EARTHSHAKER"] = 58] = "ROBOT_EARTHSHAKER";
    WeaponTypes[WeaponTypes["PMINE"] = 51] = "PMINE";
})(WeaponTypes || (WeaponTypes = {}));
var WeaponRenderTypes;
(function (WeaponRenderTypes) {
    WeaponRenderTypes[WeaponRenderTypes["NONE"] = -1] = "NONE";
    WeaponRenderTypes[WeaponRenderTypes["LASER"] = 0] = "LASER";
    WeaponRenderTypes[WeaponRenderTypes["BLOB"] = 1] = "BLOB";
    WeaponRenderTypes[WeaponRenderTypes["POLYMODEL"] = 2] = "POLYMODEL";
    WeaponRenderTypes[WeaponRenderTypes["VCLIP"] = 3] = "VCLIP";
})(WeaponRenderTypes || (WeaponRenderTypes = {}));
var WeaponInfo = /** @class */ (function () {
    function WeaponInfo() {
    }
    WeaponInfo.prototype.load = function (stream, file_version, iWeapon) {
        this.index = iWeapon;
        this.render_type = stream.getUint8();
        this.persistent = stream.getUint8();
        this.model_num = stream.getInt16();
        this.model_num_inner = stream.getInt16();
        this.flash_vclip = stream.getUint8();
        this.robot_hit_vclip = stream.getUint8();
        this.flash_sound = stream.getInt16();
        this.wall_hit_vclip = stream.getUint8();
        this.fire_count = stream.getUint8();
        this.robot_hit_sound = stream.getInt16();
        this.ammo_usage = stream.getUint8();
        this.weapon_vclip = stream.getUint8();
        this.wall_hit_sound = stream.getInt16();
        this.destroyable = stream.getUint8();
        this.matter = stream.getUint8();
        this.bounce = stream.getUint8();
        this.homing_flag = stream.getUint8();
        this.speedvar = stream.getUint8();
        this.flags = stream.getUint8();
        this.flash = stream.getUint8();
        this.afterburner_size = stream.getUint8();
        if (file_version >= 3) {
            this.children = stream.getUint8();
        }
        else {
            switch (iWeapon) {
                case WeaponTypes.SMART:
                    this.children = WeaponTypes.PLAYER_SMART_HOMING;
                    break;
                case WeaponTypes.SUPERPROX:
                    this.children = WeaponTypes.SMART_MINE_HOMING;
                    break;
                default:
                    this.children = -1;
                    break;
            }
        }
        this.energy_usage = stream.getFixed();
        this.fire_wait = stream.getFixed();
        if (file_version >= 3) {
            this.multi_damage_scale = stream.getFixed();
        }
        else {
            this.multi_damage_scale = 1;
        }
        this.bitmap = stream.getInt16();
        this.blob_size = stream.getFixed();
        this.flash_size = stream.getFixed();
        this.impact_size = stream.getFixed();
        this.strength = stream.getFixedArray(NDL);
        this.speed = stream.getFixedArray(NDL);
        this.mass = stream.getFixed();
        this.drag = stream.getFixed();
        this.thrust = stream.getFixed();
        this.po_len_to_width_ratio = stream.getFixed();
        this.light = stream.getFixed();
        this.lifetime = stream.getFixed();
        this.damage_radius = stream.getFixed();
        this.picture = stream.getInt16();
        if (file_version >= 3) {
            this.hires_picture = stream.getInt16();
        }
        else {
            this.hires_picture = this.picture;
        }
        return this;
    };
    WeaponInfo.prototype.createObject = function (parent, pos, cube, dir) {
        var obj = new Item(ItemTypes.WEAPON, this.index);
        // const parent = _level.rgObjects[0];
        // orient = Mat3.createLook(parent.orient._[2], parent.orient._[1]);
        obj.link(cube);
        obj.pos = pos;
        obj.size = this.blob_size || 1;
        obj.flags = 0;
        obj.parent = parent;
        if (parent) {
            obj.orient = Mat3.createLook(dir, parent.orient._[1]);
        }
        else {
            throw new Error("asdasd");
        } // obj.orient = Mat3.I;
        obj.controlType = ControlTypes.WEAPON;
        obj.movementType = MovementTypes.PHYSICS;
        var pi = new PhysicsInfo();
        pi.mass = this.mass;
        pi.drag = this.drag;
        if (this.bounce) {
            pi.flags |= PhysicsFlags.BOUNCE;
            if (this.bounce === 2) {
                pi.flags |= PhysicsFlags.BOUNCES_TWICE;
            }
        }
        var speed = this.speed[_difficultyLevel];
        if (this.speedvar !== 128) {
            speed *= (1 - (this.speedvar * Math.random() / 64));
        }
        if (this.thrust !== 0) {
            speed /= 2;
        }
        pi.velocity = dir.scale(speed);
        var size = this.blob_size;
        var rtype;
        switch (this.render_type) {
            case WeaponRenderTypes.BLOB:
                rtype = RenderTypes.LASER;
                break;
            case WeaponRenderTypes.POLYMODEL:
                rtype = RenderTypes.POLYOBJ;
                obj.renderInfo = new PolygonRenderInfo(this.model_num);
                size = _ham.rgPolygonModels[this.model_num].rad / this.po_len_to_width_ratio;
                break;
            case WeaponRenderTypes.NONE:
                rtype = RenderTypes.NONE;
                size = 1;
                break;
            case WeaponRenderTypes.VCLIP:
                rtype = RenderTypes.WEAPON_VCLIP;
                break;
            default:
                throw new Error("invalid weapon render type");
        }
        obj.renderType = rtype;
        obj.size = size;
        obj.shields = this.strength[_difficultyLevel];
        obj.multiplier = 1;
        obj.weaponInfo = this;
        obj.mover = pi;
        return obj;
    };
    return WeaponInfo;
}());
var PowerupInfo = /** @class */ (function () {
    function PowerupInfo() {
    }
    PowerupInfo.prototype.load = function (stream) {
        this.vclip_num = stream.getInt32();
        this.hit_sound = stream.getInt32();
        this.size = stream.getFixed();
        this.light = stream.getFixed();
        return this;
    };
    return PowerupInfo;
}());
var MAX_SUBMODELS = 10;
var OpCodes;
(function (OpCodes) {
    OpCodes[OpCodes["EOF"] = 0] = "EOF";
    OpCodes[OpCodes["DEFPOINTS"] = 1] = "DEFPOINTS";
    OpCodes[OpCodes["FLATPOLY"] = 2] = "FLATPOLY";
    OpCodes[OpCodes["TMAPPOLY"] = 3] = "TMAPPOLY";
    OpCodes[OpCodes["SORTNORM"] = 4] = "SORTNORM";
    OpCodes[OpCodes["RODBM"] = 5] = "RODBM";
    OpCodes[OpCodes["SUBCALL"] = 6] = "SUBCALL";
    OpCodes[OpCodes["DEFP_START"] = 7] = "DEFP_START";
    OpCodes[OpCodes["GLOW"] = 8] = "GLOW";
})(OpCodes || (OpCodes = {}));
var PolygonModel = /** @class */ (function () {
    function PolygonModel() {
    }
    PolygonModel.prototype.load = function (stream) {
        this.n_models = stream.getInt32();
        if (this.n_models < 0) {
            throw new Error("invalid count");
        }
        this.model_data_size = stream.getInt32();
        if (this.model_data_size < 0) {
            throw new Error("invalid size");
        }
        stream.getInt32(); // bogus model_data
        this.submodel_ptrs = stream.getInt32Array(MAX_SUBMODELS);
        this.submodel_offsets = stream.getVectorArray(MAX_SUBMODELS);
        this.submodel_norms = stream.getVectorArray(MAX_SUBMODELS);
        this.submodel_pnts = stream.getVectorArray(MAX_SUBMODELS);
        this.submodel_rads = stream.getFixedArray(MAX_SUBMODELS);
        this.submodel_parents = stream.getUint8Array(MAX_SUBMODELS);
        this.submodel_mins = stream.getVectorArray(MAX_SUBMODELS);
        this.submodel_maxs = stream.getVectorArray(MAX_SUBMODELS);
        this.mins = stream.getVector();
        this.maxs = stream.getVector();
        this.rad = stream.getFixed();
        this.n_textures = stream.getUint8();
        this.first_texture = stream.getInt16();
        this.simpler_model = stream.getUint8();
        return this;
    };
    PolygonModel.prototype.loadData = function (stream) {
        this.model_data = new DataStream(stream.view.slice(stream.position, this.model_data_size));
        stream.position += this.model_data_size;
    };
    PolygonModel.prototype.render = function (light, anim_angles) {
        var _this = this;
        if (!this.rgInstructions) {
            var compile_1 = function (position) {
                var rgInstructions = [];
                var oldPos = data_1.position;
                data_1.position = position;
                while (true) {
                    var pc = data_1.position;
                    var op = void 0;
                    switch (op = data_1.getUint16()) {
                        case OpCodes.EOF:
                            // case OpCodes.GLOW:
                            data_1.position = oldPos;
                            return rgInstructions;
                        case OpCodes.DEFP_START:
                            var n = data_1.getUint16();
                            var s = data_1.getUint16();
                            data_1.position += 2;
                            while (n-- > 0) {
                                rgPoints_1[s++] = data_1.getVector();
                            }
                            break;
                        case OpCodes.SORTNORM:
                            {
                                data_1.position += 2;
                                var plane = new Plane3(data_1.getVector(), data_1.getVector());
                                var addr1 = data_1.getInt16();
                                var addr2 = data_1.getInt16();
                                var sub1 = compile_1(pc + addr1);
                                var sub2 = compile_1(pc + addr2);
                                rgInstructions = rgInstructions.concat(sub1);
                                rgInstructions = rgInstructions.concat(sub2);
                                break;
                            }
                        case OpCodes.SUBCALL:
                            {
                                var iAngle = data_1.getUint16();
                                var pos = data_1.getVector();
                                var addr = data_1.getInt16();
                                var sub = compile_1(pc + addr);
                                rgInstructions.push((function (iAngle, pos, rgInstructions) {
                                    return function (light, anim_angles) {
                                        var angles = anim_angles ? anim_angles[iAngle] : null;
                                        var mat = createAngleMatrix(angles, pos);
                                        if (mat) {
                                            pushInstanceMatrix(mat);
                                        }
                                        var cInstructions = rgInstructions.length;
                                        for (var i = 0; i < cInstructions; ++i) {
                                            rgInstructions[i](light, anim_angles);
                                        }
                                        if (mat) {
                                            popMatrix();
                                        }
                                    };
                                })(iAngle, pos, sub));
                                break;
                            }
                        case OpCodes.TMAPPOLY:
                            {
                                var nv = data_1.getUint16();
                                var plane = new Plane3(data_1.getVector(), data_1.getVector());
                                data_1.position = pc + 28;
                                var objBitmap = _ham.rgObjBitmaps[_ham.rgObjBitmapPtrs[$this_1.first_texture + data_1.getUint16()]];
                                var offset = rgVertexPosition_1.length / 3;
                                for (var i = 0; i < nv; ++i) {
                                    var pos = rgPoints_1[data_1.getUint16()];
                                    rgVertexPosition_1.push(pos.x, pos.y, pos.z);
                                }
                                data_1.position = pc + 30 + ((nv & ~1) + 1) * 2;
                                for (var i = 0; i < nv; ++i) {
                                    var uvl = data_1.getVector();
                                    rgVertexTextureCoord_1.push(uvl.x, uvl.y);
                                }
                                data_1.position = ((data_1.position - 1) & ~3) + 4;
                                data_1.position = pc + 30 + ((nv & ~1) + 1) * 2 + nv * 12;
                                rgInstructions.push((function (plane, objBitmap, offset, nv) {
                                    var tex = _pig.loadBitmap(objBitmap, 1).tex;
                                    return function (light, anim_angles) {
                                        // TODO check normal
                                        useProgram(programLit);
                                        loadAttribBuffer(programLit.aVertexPosition, _this.bufferVertexPosition);
                                        loadAttribBuffer(programLit.aVertexTextureCoord, _this.bufferVertexTextureCoord);
                                        bindTexture(1, tex);
                                        gl.drawArrays(gl.TRIANGLE_FAN, offset, nv);
                                    };
                                })(plane, objBitmap, offset, nv));
                                break;
                            }
                        case OpCodes.FLATPOLY:
                            {
                                var nv = data_1.getUint16();
                                var plane = new Plane3(data_1.getVector(), data_1.getVector());
                                data_1.position = pc + 28;
                                var color = data_1.getColor15();
                                var offset = rgFlatVertexPosition_1.length / 3;
                                for (var i = 0; i < nv; ++i) {
                                    var pos = rgPoints_1[data_1.getUint16()];
                                    pos.pushTo(rgFlatVertexPosition_1);
                                    color.pushTo(rgFlatVertexColor_1);
                                }
                                data_1.position = pc + 30 + ((nv & ~1) + 1) * 2;
                                rgInstructions.push((function (plane, offset, nv) {
                                    return function (light, anim_angles) {
                                        // TODO check normal
                                        useProgram(programFlat);
                                        loadAttribBuffer(programFlat.aVertexPosition, _this.bufferFlatVertexPosition);
                                        loadAttribBuffer(programFlat.aVertexColor, _this.bufferFlatVertexColor);
                                        gl.drawArrays(gl.TRIANGLE_FAN, offset, nv);
                                    };
                                })(plane, offset, nv));
                                break;
                            }
                        default:
                            throw new Error("unknown OpCode: " + op);
                    }
                }
            };
            var data_1 = this.model_data;
            var rgPoints_1 = [];
            var rgFlatVertexPosition_1 = [];
            var rgFlatVertexColor_1 = [];
            var rgVertexPosition_1 = [];
            var rgVertexTextureCoord_1 = [];
            var $this_1 = this;
            this.rgInstructions = compile_1(0);
            if (rgFlatVertexPosition_1.length) {
                this.bufferFlatVertexPosition = createBuffer(rgFlatVertexPosition_1, 3);
                this.bufferFlatVertexColor = createBuffer(rgFlatVertexColor_1, 3);
            }
            if (rgVertexPosition_1.length) {
                this.bufferVertexPosition = createBuffer(rgVertexPosition_1, 3);
                this.bufferVertexTextureCoord = createBuffer(rgVertexTextureCoord_1, 2);
            }
        }
        useProgram(programLit);
        gl.uniform3f(programLit.light, light.x, light.y, light.z);
        useProgram(programFlat);
        gl.uniform3f(programFlat.light, light.x, light.y, light.z);
        var rgInstructions = this.rgInstructions;
        var cInstructions = rgInstructions.length;
        for (var i = 0; i < cInstructions; ++i) {
            rgInstructions[i](light, anim_angles);
        }
    };
    return PolygonModel;
}());
var N_PLAYER_GUNS = 8;
var PlayerShip = /** @class */ (function () {
    function PlayerShip() {
    }
    PlayerShip.prototype.load = function (stream) {
        this.model_num = stream.getInt32();
        this.expl_vclip_num = stream.getInt32();
        this.mass = stream.getFixed();
        this.drag = stream.getFixed();
        this.max_thrust = stream.getFixed();
        this.reverse_thrust = stream.getFixed();
        this.brakes = stream.getFixed();
        this.wiggle = stream.getFixed();
        this.max_rotthrust = stream.getFixed();
        this.gun_points = stream.getVectorArray(N_PLAYER_GUNS);
        return this;
    };
    return PlayerShip;
}());
var _ham;
var BinaryHeap = /** @class */ (function () {
    function BinaryHeap(comparison) {
        this.elements = [];
        this.comparison = comparison;
    }
    BinaryHeap.prototype.push = function (element) {
        var elements = this.elements;
        // Add the new element to the end of the array.
        elements.push(element);
        // Allow it to bubble up.
        this.bubbleUp(elements.length - 1);
    };
    BinaryHeap.prototype.pop = function () {
        // Store the first element so we can return it later.
        return this.removeAt(0);
    };
    BinaryHeap.prototype.removeAt = function (i) {
        var elements = this.elements;
        if (!(i >= 0 && i < elements.length)) {
            throw new Error("argument out of range: i");
        }
        var old = elements[i];
        // Get the element at the end of the array.
        var end = elements.pop();
        // If there are any elements left, put the end element at the
        // start, and const it sink down.
        if (elements.length > 0) {
            elements[i] = end;
            this.sinkDown(i);
        }
        return old;
    };
    BinaryHeap.prototype.remove = function (node) {
        var i = this.indexOf(node);
        if (i >= 0) {
            return this.removeAt(i);
        }
        throw new Error("Node not found.");
    };
    BinaryHeap.prototype.indexOf = function (node) {
        var elements = this.elements;
        for (var i = elements.length; i--;) {
            if (elements[i] === node) {
                return i;
            }
        }
        return -1;
    };
    BinaryHeap.prototype.length = function () { return this.elements.length; };
    BinaryHeap.prototype.bubbleUp = function (n) {
        // Fetch the element that has to be moved.
        var elements = this.elements;
        var element = elements[n];
        var comparison = this.comparison;
        // When at 0, an element can not go up any further.
        while (n > 0) {
            // Compute the parent element's index, and fetch it.
            var iParent = Math.floor((n + 1) / 2) - 1;
            var parent_1 = elements[iParent];
            if (comparison(element, parent_1) > 0) {
                break;
            } // Found a parent that is less, no need to move it further.
            // Swap the elements if the parent is greater.
            elements[n] = parent_1;
            n = iParent;
            elements[n] = element;
        }
    };
    BinaryHeap.prototype.sinkDown = function (n) {
        // Look up the target element and its score.
        var elements = this.elements;
        var length = elements.length;
        var element = elements[n];
        var comparison = this.comparison;
        while (true) {
            // Compute the indices of the child elements.
            var iLeft = 2 * n + 1;
            var iRight = iLeft + 1;
            if (iLeft >= length) {
                break;
            }
            var iMin = iLeft;
            if (iRight > length) {
                var left = elements[iLeft];
                var right = elements[iRight];
                if (comparison(left, right) > 0) {
                    iMin = iRight;
                }
            }
            var min = elements[iMin];
            if (comparison(element, min) <= 0) {
                break;
            }
            elements[n] = min;
            n = iMin;
            elements[n] = element;
        }
    };
    return BinaryHeap;
}());
var _rgrgSideVertexIndices = [
    [7, 6, 2, 3],
    [0, 4, 7, 3],
    [0, 1, 5, 4],
    [2, 6, 5, 1],
    [4, 5, 6, 7],
    [3, 2, 1, 0],
];
var _bufferVertexTextureBrightness;
var _bufferVertexLight;
var Level = /** @class */ (function () {
    function Level(view) {
        var stream = new DataStream(view);
        stream.position = 0;
        var magic = stream.getString(4);
        if (magic !== "LVLP") {
            throw new Error("invalid level signature");
        }
        this.version = stream.getInt32();
        this.offsetMine = stream.getInt32();
        this.offsetGame = stream.getInt32();
        if (this.version >= 8) {
            // dummy data?
            stream.getInt32();
            stream.getUint16();
            stream.getInt8();
        }
        if (this.version < 5) {
            stream.getInt32();
        } // hostage text offset
        if (this.version > 1) {
            this.paletteName = stream.getTerminatedString(["\0", "\n"], 11);
        }
        // TODO: default level palette
        if (this.version >= 3) {
            this.reactorTime = stream.getInt32();
        }
        else {
            this.reactorTime = 30;
        }
        if (this.version >= 4) {
            this.reactorLife = stream.getInt32();
        }
        var rgFlickeringLights = null;
        if (this.version >= 7) {
            var cLights = stream.getInt32();
            rgFlickeringLights = Array_iterate(cLights, function () { return new FlickeringLight().load(stream); });
        }
        if (this.version >= 6) {
            stream.getInt32(); // secret cube?
        }
        stream.position = this.offsetMine;
        var compiledVersion = stream.getUint8();
        var cVertices = stream.getUint16();
        var cCubes = stream.getUint16();
        var rgVertices = this.rgVertices = stream.getVectorArray(cVertices);
        var _endCube = new Cube(-1);
        var rgCubes = this.cubes = new Array(cCubes);
        var rgVertexPosition = [];
        var rgVertexTextureCoord = [];
        var rgVertexLight = [];
        var rgVertexBrightness = [];
        var _loop_1 = function (iCube) {
            // console.log("cube " + iCube);
            var sideMask = stream.getUint8();
            var cube = getCube(iCube);
            var rgNeighbors = void 0;
            if (this_1.version === 5) {
                readSpecial(cube, sideMask);
                readVertices(cube);
                rgNeighbors = readChildren(sideMask);
            }
            else {
                rgNeighbors = readChildren(sideMask);
                readVertices(cube);
                if (this_1.version <= 1) {
                    readSpecial(cube, sideMask);
                }
            }
            if (this_1.version <= 5) {
                cube.static_light = fix(stream.getUint16() << 4);
            }
            var rgSwitches = new Uint8Array(6);
            var sideMask2 = stream.getUint8();
            for (var iSide = 0; iSide < 6; ++iSide) {
                if (sideMask2 & (1 << iSide)) {
                    rgSwitches[iSide] = stream.getUint8();
                }
                else {
                    rgSwitches[iSide] = -1;
                }
            }
            for (var iSide = 0; iSide < 6; ++iSide) {
                var rgSideVertexIndices = _rgrgSideVertexIndices[iSide];
                var rgOtherVertices = rgSideVertexIndices.map(function (iVertex) { return cube.rgVertices[iVertex]; });
                var neighbor = rgNeighbors[iSide];
                var side = cube.rgSides[iSide] = new Side(cube, iSide, neighbor, rgOtherVertices);
                var iSwitch = rgSwitches[iSide];
                if (iSwitch < 255 || !side.neighbor) {
                    side.load(stream);
                    // side.tmi = _ham.rgTMapInfos[side.tex1];
                    side.iSwitch = iSwitch;
                }
            }
        };
        var this_1 = this;
        for (var iCube = 0; iCube < cCubes; ++iCube) {
            _loop_1(iCube);
        }
        for (var iCube = 0; iCube < cCubes; ++iCube) {
            var cube = this.cubes[iCube];
            if (this.version > 5) {
                cube.load2(stream);
            }
            for (var iSide = 6; iSide--;) {
                var side = cube.rgSides[iSide];
                side.initializeBuffers(rgVertexPosition, rgVertexLight, rgVertexTextureCoord, rgVertexBrightness);
            }
        }
        // initialize lighting cubes
        for (var iCube = cCubes; iCube--;) {
            var cube = this.cubes[iCube];
            var radius2 = cube.radius * cube.radius;
            for (var iCubeOther = cCubes; iCubeOther--;) {
                var cubeOther = this.cubes[iCubeOther];
                var minDistance = cube.radius + cubeOther.radius + LIGHT_DISTANCE_THRESHOLD;
                if (cube.center.distanceTo2(cubeOther.center) < minDistance * minDistance) {
                    for (var iSide = 6; iSide--;) {
                        var side = cube.rgSides[iSide];
                        var fFound = false;
                        for (var iSideVertex = 4; !fFound && iSideVertex--;) {
                            var sideVertex = side.vertices[iSideVertex];
                            for (var iVertexOtherCube = 8; !fFound && iVertexOtherCube--;) {
                                var vertexOtherCube = cubeOther.rgVertices[iVertexOtherCube];
                                if (vertexOtherCube.distanceTo2(sideVertex) < LIGHT_DISTANCE_THRESHOLD * LIGHT_DISTANCE_THRESHOLD) {
                                    if (side.rgTriangles[0].distanceTo(vertexOtherCube) >= 0 &&
                                        side.rgTriangles[1].distanceTo(vertexOtherCube)) {
                                        fFound = true;
                                        break;
                                    }
                                }
                            }
                        }
                        if (fFound) {
                            side.rgLightingCubes.push(cubeOther);
                        }
                    }
                }
            }
        }
        this.bufferVertexPosition = createBuffer(rgVertexPosition, 3);
        this.bufferVertexLight = createDynamicBuffer(rgVertexLight, 3);
        this.bufferVertexTextureCoord = createBuffer(rgVertexTextureCoord, 2);
        this.bufferVertexTextureBrightness = createDynamicBuffer(rgVertexBrightness, 1);
        _bufferVertexTextureBrightness = this.bufferVertexTextureBrightness;
        _bufferVertexLight = this.bufferVertexLight;
        if (rgFlickeringLights) {
            for (var iLight = rgFlickeringLights.length; iLight--;) {
                var fl = rgFlickeringLights[iLight];
                var side = this.getSide(fl.segnum, fl.sidenum);
                side.light = fl;
            }
        }
        stream.position = this.offsetGame;
        var gameSig = stream.getUint16();
        if (gameSig !== 0x6705) {
            throw new Error("invalid level game signature: " + gameSig);
        }
        var gameVersion = stream.getUint16();
        stream.gameVersion = gameVersion;
        stream.position += 31;
        var offsetObjects = stream.getUint32();
        var cObjects = stream.getUint32();
        stream.position += 8;
        var cWalls = stream.getUint32();
        stream.position += 20;
        var cTriggers = stream.getUint32();
        stream.position += 24;
        var triggerSize = stream.getUint32();
        stream.position += 4;
        var cRobotCenters = stream.getUint32();
        stream.position += 4;
        var cStaticLights = 0;
        var cDeltaLights = 0;
        if (gameVersion >= 29) {
            stream.position += 4;
            cStaticLights = stream.getUint32();
            stream.position += 8;
            cDeltaLights = stream.getUint32();
            stream.position += 4;
        }
        var levelName;
        if (gameVersion >= 31) {
            levelName = stream.getTerminatedString(["\n"]);
        }
        else if (gameVersion >= 14) {
            levelName = stream.getTerminatedString(["\0"]);
        }
        else {
            levelName = "";
        }
        if (gameVersion >= 19) {
            var cPOFNames = stream.getUint16();
            if (cPOFNames !== 0x614d && cPOFNames !== 0x5547) {
                this.rgPOFNames = Array_iterate(cPOFNames, function (i) {
                    return stream.getTerminatedString(["\0", "\n"], 13);
                });
            }
        }
        var $this = this;
        if (offsetObjects >= 0) {
            stream.position = offsetObjects;
            this.rgObjects = Array_iterate(cObjects, function (iObject) {
                var obj = Item.load(stream);
                if (obj.type === ItemTypes.COOP) {
                    return;
                }
                var pos = obj.pos;
                var cube = $this.getCube(obj.iCube);
                if (!cube.isPointInside(pos)) {
                    console.log("object " + iObject + " outside cube " + cube.index);
                    var foundCube = $this.findCubeContaining(pos);
                    if (!foundCube) {
                        throw new Error("orphaned object");
                    }
                    cube = foundCube;
                }
                obj.link(cube);
                return obj;
            });
        }
        if (gameVersion < 20) {
            throw new Error("level game info version not supported: " + gameVersion);
        }
        // load walls
        var rgWalls = Array_iterate(cWalls, function () { return new Wall().load(stream); });
        if (gameVersion < 31) {
            throw new Error("level game info version not supported: " + gameVersion);
        }
        // load triggers
        var rgTriggers = Array_iterate(cTriggers, function () { return new Trigger().load(stream); });
        var _loop_2 = function (iTrigger) {
            var trigger = rgTriggers[iTrigger];
            trigger.rgSides = Array_iterate(trigger.num_links, function (i) { return $this.getSide(trigger.seg[i], trigger.side[i]); });
            // delete trigger.seg;
            // delete trigger.side;
        };
        for (var iTrigger = cTriggers; iTrigger--;) {
            _loop_2(iTrigger);
        }
        for (var iWall = cWalls; iWall--;) {
            var wall = rgWalls[iWall];
            wall.iWall = iWall;
            var side = this.getSide(wall.segnum, wall.sidenum);
            side.wall = wall;
            if (!wall.side) {
                wall.side = side;
            }
            var otherSide = side.otherSide;
            if (otherSide) {
                if (otherSide.wall) {
                    otherSide.wall.otherWall = wall;
                    wall.otherWall = otherSide.wall;
                }
                else {
                    otherSide.wall = wall;
                }
            }
            if (wall.linked_wall >= 0) {
                wall.linked_wall = rgWalls[wall.linked_wall];
            }
            if (wall.iTrigger >= 0) {
                // console.log(iWall, wall.iTrigger);
                wall.trigger = rgTriggers[wall.iTrigger];
            }
        }
        var rgControlCenterTriggers = Array_iterate(1, function () { return new ControlCenterTrigger().load(stream); });
        // read materialization centers
        if (gameVersion < 27) {
            throw new Error("level game info version not supported: " + gameVersion);
        }
        this.rgRobotCenters = Array_iterate(cRobotCenters, function () { return new RobotCenter().load(stream); });
        var rgDeltaLightIndices = Array_iterate(cStaticLights, function () { return new DeltaLightIndex().load(stream); });
        var rgDeltaLights = Array_iterate(cDeltaLights, function () { return new DeltaLight().load(stream); });
        for (var iLight = rgDeltaLights.length; iLight--;) {
            var dl = rgDeltaLights[iLight];
            var side = this.getSide(dl.segnum, dl.sidenum);
            dl.side = side;
        }
        var _loop_3 = function (iLight) {
            var lightIndex = rgDeltaLightIndices[iLight];
            var side = this_2.getSide(lightIndex.segnum, lightIndex.sidenum);
            side.rgDeltaLights = Array_iterate(lightIndex.count, function (i) { return rgDeltaLights[lightIndex.index + i]; });
        };
        var this_2 = this;
        for (var iLight = rgDeltaLightIndices.length; iLight--;) {
            _loop_3(iLight);
        }
        function getCube(i) {
            var cube = rgCubes[i];
            if (!cube) {
                cube = rgCubes[i] = new Cube(i);
            }
            return cube;
        }
        function readChildren(sideMask) {
            var rgNeighbors = new Array(6);
            for (var iSide = 0; iSide < 6; ++iSide) {
                if (sideMask & (1 << iSide)) {
                    var iNeighbor = stream.getUint16();
                    if (iNeighbor < cCubes) {
                        rgNeighbors[iSide] = getCube(iNeighbor);
                        // console.log("cube " + iCube + " [" + iSide + "] -> " + iNeighbor);
                    }
                    else if (iNeighbor === 65534) {
                        rgNeighbors[iSide] = _endCube;
                    }
                    else if (iNeighbor !== 65535) {
                        throw new Error("neighbor out of range");
                    }
                }
            }
            return rgNeighbors;
        }
        function readVertices(cube) {
            var center = Vec3.Zero;
            for (var iVertex = 0; iVertex < 8; ++iVertex) {
                var iCubeVertex = stream.getUint16();
                if (iCubeVertex >= cVertices) {
                    throw new Error("vertex index out of range");
                }
                var vertex = rgVertices[iCubeVertex];
                cube.rgVertices[iVertex] = vertex;
                center = center.add(vertex);
            }
            cube.center = center = center.scale(1.0 / 8.0);
            var radius2 = 0;
            for (var iVertex = 0; iVertex < 8; ++iVertex) {
                var dist2 = center.distanceTo2(cube.rgVertices[iVertex]);
                if (radius2 < dist2) {
                    radius2 = dist2;
                }
            }
            cube.radius = Math.sqrt(radius2);
        }
        function readSpecial(cube, sideMask) {
            if (sideMask & (1 << 6)) {
                cube.special = stream.getUint8();
                cube.iMatCen = stream.getInt8();
                cube.value = stream.getInt8();
                stream.getInt8(); // skip
                // console.log("cube " + iCube + " special: ", cube.special, cube.iMatCen, cube.value);
            }
        }
    }
    Level.prototype.getCube = function (iCube) {
        if (!(iCube >= 0 && iCube < this.cubes.length)) {
            throw new Error("cube index out of range: " + iCube);
        }
        return this.cubes[iCube];
    };
    Level.prototype.getSideByIndex = function (index) {
        return this.getSide(index.iCube, index.iSide);
    };
    Level.prototype.getSide = function (iCube, iSide) {
        var cube = this.getCube(iCube);
        if (!(iSide >= 0 && iSide < 6)) {
            throw new Error("side index out of range: " + iSide);
        }
        return cube.rgSides[iSide];
    };
    Level.prototype.findCubeContaining = function (pt) {
        var cubes = this.cubes;
        for (var iCube = cubes.length; iCube--;) {
            var cube = cubes[iCube];
            if (cube.isPointInside(pt)) {
                return cube;
            }
        }
        return null;
    };
    Level.prototype.update = function (time, frameTime) {
        var rgObjects = this.rgObjects;
        for (var iObject = rgObjects.length; iObject--;) {
            var object = rgObjects[iObject];
            if (!object.update(time, frameTime)) {
                object.link(null);
                rgObjects.swapOut(iObject);
            }
        }
        this.cleanObjects();
        for (var iDoor = _rgActiveDoors.length; iDoor--;) {
            var door = _rgActiveDoors[iDoor];
            if (!door.updateDoor(time, frameTime)) {
                _rgActiveDoors.swapOut(iDoor);
            }
        }
    };
    Level.prototype.cleanObjects = function () {
        var rgObjects = this.rgObjects;
        for (var iObject = rgObjects.length; iObject--;) {
            var object = rgObjects[iObject];
            if (object.isDead()) {
                //object.link(null);
                rgObjects.swapOut(iObject);
            }
        }
    };
    return Level;
}());
var _rgActiveDoors = [];
var LIGHT_DISTANCE_THRESHOLD = 80;
// values for special field
var CubeFlags;
(function (CubeFlags) {
    CubeFlags[CubeFlags["IS_NOTHING"] = 0] = "IS_NOTHING";
    CubeFlags[CubeFlags["IS_FUELCEN"] = 1] = "IS_FUELCEN";
    CubeFlags[CubeFlags["IS_REPAIRCEN"] = 2] = "IS_REPAIRCEN";
    CubeFlags[CubeFlags["IS_CONTROLCEN"] = 3] = "IS_CONTROLCEN";
    CubeFlags[CubeFlags["IS_ROBOTMAKER"] = 4] = "IS_ROBOTMAKER";
    CubeFlags[CubeFlags["IS_GOAL_BLUE"] = 5] = "IS_GOAL_BLUE";
    CubeFlags[CubeFlags["IS_GOAL_RED"] = 6] = "IS_GOAL_RED";
    CubeFlags[CubeFlags["MAX_CENTER_TYPES"] = 7] = "MAX_CENTER_TYPES";
    CubeFlags[CubeFlags["AMBIENT_WATER"] = 8] = "AMBIENT_WATER";
    CubeFlags[CubeFlags["AMBIENT_LAVA"] = 9] = "AMBIENT_LAVA";
})(CubeFlags || (CubeFlags = {}));
var Cube = /** @class */ (function () {
    function Cube(index) {
        this.index = index;
        this.rgVertices = new Array(8);
        this.rgSides = new Array(6);
        this.static_light = 1;
        this._unique = (__unique++).toString();
        this._rgObjects = [];
    }
    Cube.prototype.load2 = function (stream) {
        this.special = stream.getUint8();
        this.matcen_num = stream.getUint8();
        this.value = stream.getUint8();
        this.special |= (stream.getUint8() << 8);
        this.static_light = stream.getFixed();
    };
    Cube.prototype.isPointInside = function (pt) {
        var rgSides = this.rgSides;
        for (var iSide = 6; iSide--;) {
            var side = rgSides[iSide];
            if (side && !side.isPointInside(pt)) {
                return false;
            }
        }
        return true;
    };
    Cube.prototype.render = function (time, fWireframe) {
        var rgSides = this.rgSides;
        for (var iSide = 6; iSide--;) {
            var side = rgSides[iSide];
            side.render(time, fWireframe);
        }
    };
    Cube.prototype.renderObjects = function (time, viewPlane) {
        var rgObjects = this._rgObjects;
        for (var iObject = rgObjects.length; iObject--;) {
            var obj = rgObjects[iObject];
            if (viewPlane && viewPlane.distanceTo(obj.pos) < 0) {
                continue;
            }
            obj.render(time);
        }
    };
    /*
    getVisibleNeighbors ()
    {
        if (this.rgVisibleNeighbors)
            return this.rgVisibleNeighbors;

        const rgVisible = [];
        const mapVisible = {};

        const rgVisibleSides = [];
        const rgVisibleSidesBlended = [];
        const mapVisibleSides = {};

        const mapVisited = {};
        const rgVisited = [];

        const rgDebug;// = this.rgDebug = [];

        const root = this;

        // const iSide = this.rgSides.concat().sort((s1, s2) => { return s2.rgTriangles[0].normal.z - s1.rgTriangles[0].normal.z; })[0].index;
        for (let iSide = 6; iSide--;)
        {
            const side = this.rgSides[iSide];
            const rgVertices = side.vertices;

            const rgEdges = new Array (4);
            const rgReverses = new Array (4);

            for (let iEdge = 4; iEdge--;)
            {
                const edge = new LineSegment(rgVertices[iEdge], rgVertices[(iEdge + 1) % 4]);
                rgEdges[iEdge] = edge
                rgReverses[iEdge] = Plane3.fromPoints(edge.start, rgVertices[(iEdge + 3) % 4], edge.end);
                rgReverses[iEdge].normal = rgReverses[iEdge].normal.unit();
            }

            const recurse = function (cube, rgPlanes, depth)
            {
                if (depth > 25)
                    return;

                mapVisited[cube._unique] = true;

                if (!mapVisible[cube.index])
                {
                    mapVisible[cube.index] = cube;
                    rgVisible.push(cube);
                }

                for (let iOtherSide = 6; iOtherSide--;)
                {
                    const otherSide = cube.rgSides[iOtherSide];
                    const neighbor = otherSide.neighbor;

                    if (neighbor)
                    {
                        if (mapVisited[neighbor._unique])
                            continue;
                    }
                    else
                    {
                        if (mapVisibleSides[otherSide._unique])
                            continue;
                    }

                    rgVisited.push(otherSide);

                    const minPlanes = new Array(4);

                    const debug;
                    if (rgDebug)
                    {
                        debug = {
                            cube: cube,
                            depth: depth,
                            side: otherSide,
                            planes: rgPlanes.concat(),
                            rgVisited: rgVisited.concat(),
                            rgEdges: rgEdges.concat(),
                            rgFront: [],
                            rgBehind: [],
                            rgNewStarts: [],
                            minPlanes: minPlanes,
                            extents: [],
                            reverses: rgReverses,
                            callback () { recurse(cube, rgPlanes, depth); };
                        }
                        rgDebug.push(debug);
                    }

                    const rgOtherVertices = otherSide.vertices;
                    const fOutside = false;
                    const fFrontSide = false;
                    for (let iEdge = 4; iEdge--;)
                    {
                        const edge = rgEdges[iEdge];
                        const vertex = edge.start;
                        if (true || otherSide.rgTriangles[0].distanceTo(vertex) >= 0 ||
                            otherSide.rgTriangles[1].distanceTo(vertex) >= 0)
                        {
                            const minPlane = rgReverses[iEdge];

                            const plane = rgPlanes[iEdge];
                            const extent;

                            const fFront = false;
                            const fBehind = false;

                            for (let iVertex = 4; iVertex--;)
                            {
                                const vertexOther = rgOtherVertices[iVertex];

                                if (plane.distanceTo(vertexOther) < 0)
                                {
                                    fBehind = true;
                                    if (fFront)
                                        break;
                                }
                                else
                                {
                                    fFront = true;
                                    if (fBehind)
                                        break;

                                    if (minPlane.distanceTo(vertexOther) < -.0001)
                                    {
                                        minPlane = new Plane3(vertex, edge.direction.cross(vertexOther.sub(vertex)).unit());
                                        extent = vertexOther;
                                    }
                                }
                            }

                            if (debug)
                            {
                                debug.rgFront[iEdge] = fFront;
                                debug.rgBehind[iEdge] = fBehind;
                                debug.extents[iEdge] = extent;
                            }

                            if (fBehind)
                            {
                                if (fFront)
                                {
                                    minPlane = plane;
                                }
                                else
                                {
                                    if (debug)
                                        debug.iOutside = iEdge;
                                    fOutside = true;
                                    break;
                                }
                            }

                            minPlanes[iEdge] = minPlane;
                        }
                        else
                        {
                            const newStart = edge.intersectPlane(otherSide.rgTriangles[0]);
                            if (newStart)
                                minPlanes[iEdge] = new Plane3(newStart, otherSide.rgTriangles[0].normal.unit().neg());
                            else
                                minPlanes[iEdge] = rgReverses[iEdge].reverse();

                            if (debug)
                                debug.rgNewStarts[iEdge] = newStart;
                        }
                    }

                    if (!fOutside)
                    {
                        // if (minPlanes[0].normal.dot(minPlanes[1].normal) > 0)
                        // {
                        // 	debug.reject = "0/2";
                        // }
                        // if (minPlanes[2].normal.dot(minPlanes[3].normal) > 0)
                        // {
                        // 	debug.reject = "1/3";
                        // }
                        // else
                        {
                            if (!mapVisibleSides[otherSide._unique])
                            {
                                mapVisibleSides[otherSide._unique] = otherSide;
                                if (neighbor)
                                    rgVisibleSidesBlended.push(otherSide);
                                else
                                    rgVisibleSides.push(otherSide);
                            }

                            if (neighbor)
                            {
                                const tmpDebug = rgDebug;
                                if (rgDebug)
                                {
                                    const childDebug = [];
                                    debug.children = childDebug
                                    rgDebug = childDebug;
                                }

                                recurse(neighbor, minPlanes, depth + 1);

                                rgDebug = tmpDebug;
                            }
                        }
                    }
                    rgVisited.pop();
                }

                delete mapVisited[cube._unique];
            }

            const rgDebugTmp = rgDebug;
            if (rgDebug)
            {
                rgDebug = [];
                const debug = {
                    cube: this,
                    side: side,
                    depth: -1,
                    children: rgDebug,
                }
                rgDebugTmp.push(debug);
            }

            const rgInits = rgReverses.map((p) => { return p.reverse(); });
            recurse(this, rgInits, 1);

            rgDebug = rgDebugTmp;
        }
        // console.log(rgVisibleSides.length);

        // function compareSides(side1, side2)
        // {
        // 	const tex1 = side1.tex2;
        // 	const tex2 = side2.tex2;
        // 	if (tex1 !== tex2)
        // 	{
        // 		if (tex1 === undefined)
        // 			return -1;
        // 		if (tex2 === undefined)
        // 			return 1;
        // 		return tex1 - tex2;
        // 	}

        // 	return side1.tex1 - side2.tex1;
        // }

        // rgVisibleSides.sort(compareSides);
        // rgVisibleSidesBlended.sort(compareSides);

        this.rgVisibleNeighbors = rgVisible;
        this.rgVisibleSides = rgVisibleSides;
        this.rgVisibleSidesBlended = rgVisibleSidesBlended;

        return rgVisible;
    }
    getLightingNeighbors ()
    {
        const rgLightingNeighbors = this.rgLightingNeighbors;
        if (rgLightingNeighbors)
            return rgLightingNeighbors;

        const center = this.center;
        const LIGHT_DISTANCE_THRESHOLD2 = LIGHT_DISTANCE_THRESHOLD * LIGHT_DISTANCE_THRESHOLD;

        const rgLightingNeighbors = [];

        const rgVisibleNeighbors = this.getVisibleNeighbors();
        for (let iVisible = rgVisibleNeighbors.length; iVisible--;)
        {
            const cube = rgVisibleNeighbors[iVisible];
            if (cube === this)
                continue;
            if (center.distanceTo2(cube.center) < LIGHT_DISTANCE_THRESHOLD2)
                rgLightingNeighbors.push(cube);
        }

        this.rgLightingNeighbors = rgLightingNeighbors;
        return rgLightingNeighbors;
    }
    */
    Cube.prototype.addStaticLight = function (value) {
        if (!value) {
            return;
        }
        this.static_light += value;
        var center = this.center;
        var rgVisibleNeighbors = this.rgVisibleNeighbors;
        for (var iVisible = rgVisibleNeighbors.length; iVisible--;) {
            var cube = rgVisibleNeighbors[iVisible];
            var distance = center.distanceTo(cube.center);
            if (distance < 1) {
                distance = 1;
            }
            cube.static_light += value / distance;
        }
    };
    Cube.prototype.bounce = function (line, size) {
        var bestBounce = null;
        for (var iSide = 6; iSide--;) {
            var side = this.rgSides[iSide];
            var bounce = side.bounce(line, size);
            if (bounce) {
                if (!bestBounce || bestBounce.distance > bounce.distance) {
                    bestBounce = bounce;
                }
            }
        }
        if (bestBounce) {
            bestBounce.cube = this;
        }
        return bestBounce;
    };
    Cube.prototype.checkExit = function (line) {
        for (var iSide = 6; iSide--;) {
            var side = this.rgSides[iSide];
            if (side.checkExit(line)) {
                return side;
            }
        }
        return null;
    };
    Cube.prototype.createExplosion = function (time, pos, size, vclip, duration) {
        var renderType = (vclip >= 0) ? RenderTypes.FIREBALL : RenderTypes.NONE;
        var obj = this.createObject(ItemTypes.FIREBALL, vclip, ControlTypes.EXPLOSION, renderType, MovementTypes.NONE, pos, size);
        obj.creationTime = time;
        if (vclip >= 0) {
            obj.renderInfo = new OneShotVClipRenderInfo(vclip);
            obj.deathTime = time + _ham.rgVClips[vclip].play_time;
        }
        else if (duration) {
            obj.deathTime = duration;
        }
        else {
            // TODO: huh?
        }
        // TODO: damage other objects
        return obj;
    };
    Cube.prototype.createObject = function (type, id, controlType, renderType, movementType, pos, size) {
        var obj = new Item(type, id);
        obj.pos = pos;
        obj.size = size;
        obj.controlType = controlType;
        obj.renderType = renderType;
        obj.movementType = movementType;
        obj.link(this);
        _level.rgObjects.push(obj);
        return obj;
    };
    return Cube;
}());
var CubePos = /** @class */ (function () {
    function CubePos(cube, pos) {
        this.cube = cube;
        if (!cube) {
            throw new Error();
        }
        if (!pos) {
            this.pos = cube.center;
        }
    }
    CubePos.prototype.createPathTo = function (dest) {
        var queueNext = new BinaryHeap(comparePos);
        var mapNext = {};
        var mapVisited = {};
        this.G = 0;
        this.prev = null;
        queueNext.push(this);
        while (queueNext.length() > 0) {
            var posCurrent = queueNext.pop();
            var cubeCurrent = posCurrent.cube;
            if (cubeCurrent === dest.cube) {
                var result = [];
                for (; posCurrent; posCurrent = posCurrent.prev) {
                    result.push(posCurrent);
                }
                result.reverse();
                result.push(dest);
                return result;
            }
            mapVisited[cubeCurrent._unique] = posCurrent;
            for (var iSide = 6; iSide--;) {
                var side = cubeCurrent.rgSides[iSide];
                var cubeNeighbor = side.neighbor;
                if (cubeNeighbor) {
                    if (mapVisited[cubeNeighbor._unique]) {
                        continue;
                    } // TODO shorten path?
                    if (side.getDoorwayFlags() & WID.FLY) {
                        var G = posCurrent.G + posCurrent.pos.distanceTo2(cubeNeighbor.center);
                        var posNeighbor = mapNext[cubeNeighbor._unique];
                        if (posNeighbor) {
                            if (posNeighbor.G > G) {
                                continue;
                            }
                            queueNext.remove(posNeighbor);
                        }
                        else {
                            posNeighbor = new CubePos(cubeNeighbor, cubeNeighbor.center);
                            posNeighbor.H = cubeNeighbor.center.distanceTo2(dest.pos);
                        }
                        posNeighbor.prev = posCurrent;
                        posNeighbor.G = G;
                        posNeighbor.F = G + posNeighbor.H;
                        queueNext.push(posNeighbor);
                        mapNext[cubeNeighbor._unique] = posNeighbor;
                    }
                }
            }
        }
        return null;
        function comparePos(p1, p2) {
            return p1.F - p2.F;
        }
    };
    CubePos.prototype.bounce = function (to, size) {
        if (size === void 0) { size = 0; }
        var pos = this.pos;
        var cube = this.cube;
        while (true) {
            var line = new LineSegment(pos, to);
            var bounce = cube.bounce(line, size);
            if (!bounce || bounce.distance > line.length) {
                break;
            }
            var side = bounce.side;
            if (side.isSolid()) {
                return bounce;
            }
            cube = side.neighbor;
            pos = bounce.anchor;
        }
        return null;
    };
    return CubePos;
}());
var WID;
(function (WID) {
    WID[WID["FLY"] = 1] = "FLY";
    WID[WID["RENDER"] = 2] = "RENDER";
    WID[WID["RENDPAST"] = 4] = "RENDPAST";
    WID[WID["EXTERNAL"] = 8] = "EXTERNAL";
    WID[WID["CLOAKED"] = 16] = "CLOAKED";
    WID[WID["WALL"] = 2] = "WALL";
    WID[WID["TRANSPARENT_WALL"] = 6] = "TRANSPARENT_WALL";
    WID[WID["ILLUSORY_WALL"] = 3] = "ILLUSORY_WALL";
    WID[WID["TRANSILLUSORY_WALL"] = 7] = "TRANSILLUSORY_WALL";
    WID[WID["NO_WALL"] = 5] = "NO_WALL";
})(WID || (WID = {}));
var _rgOrientMatrices = [
    Mat3.I,
    Mat3.I.translate2d(-.5, -.5).rotate2d(-3 * Math.PI / 2).translate2d(.5, .5),
    Mat3.I.translate2d(-.5, -.5).rotate2d(-Math.PI).translate2d(.5, .5),
    Mat3.I.translate2d(-.5, -.5).rotate2d(-Math.PI / 2).translate2d(.5, .5),
].map(function (m) { return m.transpose(); });
var SideIndex = /** @class */ (function () {
    function SideIndex(iCube, iSide) {
        this.iCube = iCube;
        this.iSide = iSide;
    }
    return SideIndex;
}());
/*
interface WebGLRenderingContext
{
    uniform1fv(location: WebGLUniformLocation, v: number[]): void;
    uniform1iv(location: WebGLUniformLocation, v: number[]): void;
    uniform2fv(location: WebGLUniformLocation, v: number[]): void;
    uniform2iv(location: WebGLUniformLocation, v: number[]): void;
    uniform3fv(location: WebGLUniformLocation, v: number[]): void;
    uniform3iv(location: WebGLUniformLocation, v: number[]): void;
    uniform4fv(location: WebGLUniformLocation, v: number[]): void;
    uniform4iv(location: WebGLUniformLocation, v: number[]): void;
    uniformMatrix2fv(location: WebGLUniformLocation, transpose: boolean, value: number[]): void;
    uniformMatrix3fv(location: WebGLUniformLocation, transpose: boolean, value: number[]): void;
    uniformMatrix4fv(location: WebGLUniformLocation, transpose: boolean, value: number[]): void;
}
*/
var Side = /** @class */ (function () {
    function Side(cube, index, neighbor, vertices) {
        this.cube = cube;
        this.index = index;
        this.neighbor = neighbor;
        this.vertices = vertices;
        this.static_light = 1;
        this.deltaLight = 1;
        this.rgDeltaLight = [1, 1, 1, 1];
        this.tex2Orient = 0;
        this.brightness = 1;
        this.updateBrightness = false;
        this.rgVertexLight = new Array(4);
        this.rgLightingCubes = [];
        this._unique = (__unique++).toString();
        /*
            const n1 = rgOtherVertices [0].planeNormal (rgOtherVertices [1], rgOtherVertices [2]);
            const distToPlane = rgOtherVertices [3].distanceToPlane (rgOtherVertices [0], n1);

            if (distToPlane < 250)
            {
            }
            else
            {
            }
        */
        var sum = Vec3.Zero;
        for (var i = 4; i--;) {
            sum = sum.add(vertices[i]);
        }
        this.center = sum.scale(1 / 4);
    }
    Side.prototype.getIndex = function () {
        return new SideIndex(this.cube.index, this.index);
    };
    Side.prototype.load = function (stream) {
        var tex1 = stream.getUint16();
        if (tex1 & (1 << 15)) {
            this.setTex2(stream.getUint16(), true);
        }
        this.setTex1(tex1 & ~(1 << 15));
        this.rgUV = new Array(4);
        this.rgL = new Float32Array(4);
        for (var iVertex = 0; iVertex < 4; ++iVertex) {
            this.rgUV[iVertex] = new Vec2(fix(stream.getInt16()) * 32, fix(stream.getInt16()) * 32);
            this.rgL[iVertex] = fix(stream.getUint16() << 1);
        }
        // this.createBuffers();
    };
    /*
    createBuffers ()
    {
        if (this.tex2 >= 0)
            this.program = programDouble;
        else
            this.program = programSingle;

        const rgVertexPosition = [];
        const rgVertexTextureCoord = [];
        const rgVertexLight = [];
        const rgVertexBrightness = [];
        for (let iVertex = 0; iVertex < 4; ++iVertex)
        {
            this.vertices[iVertex].pushTo(rgVertexPosition);
            if (this.rgUV)
            {
                this.rgUV[iVertex].pushTo(rgVertexTextureCoord);
                rgVertexLight.push(1, 1, 1);	// TODO: single value

                rgVertexBrightness.push(this.rgL[iVertex]);
            }
        }

        this.bufferVertexPosition = createBuffer(rgVertexPosition, 3);
        this.bufferVertexLight = createBuffer(rgVertexLight, 3);
        this.bufferVertexTextureCoord = createBuffer(rgVertexTextureCoord, 2);
        this.bufferVertexTextureBrightness = createDynamicBuffer(rgVertexBrightness, 1);
    }
    */
    Side.prototype.initializeBuffers = function (rgVertexPosition, rgVertexLight, rgVertexTextureCoord, rgVertexBrightness) {
        var neighbor = this.neighbor;
        var vertexOffset = 0;
        var vertices = this.vertices;
        var tri = new Triangle(vertices[0], vertices[1], vertices[2]);
        var fConvex = tri.distanceTo(vertices[3]) >= 0;
        if (neighbor && neighbor.index !== -1) {
            var otherSide = this.otherSide;
            // initialize otherSide pairs
            if (!otherSide) {
                for (var iOtherSide = 6; iOtherSide--;) {
                    otherSide = neighbor.rgSides[iOtherSide];
                    if (otherSide && otherSide.neighbor === this.cube) {
                        if (otherSide.otherSide) {
                            throw new Error("otherSide.otherSide already set");
                        }
                        this.otherSide = otherSide;
                        otherSide.otherSide = this;
                        break;
                    }
                }
                if (!otherSide) {
                    throw new Error("otherSide not found!");
                }
            }
            if (!otherSide.vertexOffset) {
                // ensure vertices align
                if (this.vertices[0] === otherSide.vertices[1] ||
                    this.vertices[0] === otherSide.vertices[3]) {
                    vertexOffset = 1;
                    fConvex = !fConvex;
                }
                else {
                    if (this.vertices[0] !== otherSide.vertices[0] &&
                        this.vertices[0] !== otherSide.vertices[2]) {
                        throw new Error("otherSide vertex mismatch!");
                    }
                }
            }
        }
        else {
            // make convex
            if (!fConvex) {
                vertexOffset = 1;
                fConvex = true;
            }
        }
        this.vertexOffset = vertexOffset;
        this.convex = fConvex;
        this.rgTriangles = [
            new Triangle(vertices[vertexOffset + 0], vertices[vertexOffset + 1], vertices[vertexOffset + 2]),
            new Triangle(vertices[vertexOffset + 2], vertices[(vertexOffset + 3) % 4], vertices[vertexOffset + 0]),
        ];
        var n1 = this.rgTriangles[0].normal;
        var n2 = this.rgTriangles[1].normal;
        this.normal = n1.add(n2).unit();
        if (this.rgUV) {
            this.iVertex = rgVertexPosition.length / 3;
            if (this.tmi2) {
                this.program = programDouble;
            }
            else {
                this.program = programSingle;
            }
            for (var iVertex = 0; iVertex < 4; ++iVertex) {
                this.vertices[(vertexOffset + iVertex) % 4].pushTo(rgVertexPosition);
                rgVertexLight.push(0, 0, 0); // TODO: single value
                rgVertexBrightness.push(this.rgL[(vertexOffset + iVertex) % 4]);
                this.rgUV[(vertexOffset + iVertex) % 4].pushTo(rgVertexTextureCoord);
            }
        }
    };
    Side.prototype.isVisible = function () {
        if (!this.neighbor) {
            return true;
        }
        if (this.wall) {
            return this.wall.isVisible();
        }
        return false;
    };
    Side.prototype.isSolid = function () {
        if (!this.neighbor) {
            return true;
        }
        if (this.wall) {
            return this.wall.isSolid();
        }
        return false;
    };
    Side.prototype.isTransparent = function () {
        if (this.tmi2) {
            return this.tmi2.isTransparent();
        }
        return this.tmi1.isTransparent();
    };
    Side.prototype.isPointInside = function (pt) {
        if (this.convex) {
            return this.rgTriangles[0].distanceTo(pt) > 0 && this.rgTriangles[1].distanceTo(pt) > 0;
        }
        else {
            return this.rgTriangles[0].distanceTo(pt) > 0 || this.rgTriangles[1].distanceTo(pt) > 0;
        }
    };
    Side.prototype.render = function (time, fWireframe) {
        // const fDebugSide = _iStep && cubeDebug && cubeDebug.rgDebug[_iStep] && cube.index === cubeDebug.rgDebug[_iStep].cube.index && iSide === cubeDebug.rgDebug[_iStep].this;
        if (this.neighbor && /*isNaN(this.iSwitch) &&*/ !this.isVisible() /*&& !fDebugSide*/) {
            /*
            if (fWireframe && this.cube.index === 26)
            {
                useProgram(programFlat);

                const rgVertexPosition = Array.prototype.concat.apply(this.vertices[(this.vertexOffset + 2) % 4].flatten(), Array_iterate(4, (i) => this.vertices[(this.vertexOffset + i) % 4].flatten()));
                const bufferVertexPosition = createBuffer(rgVertexPosition, 3);

                const rgVertexLight = Array.prototype.concat.apply(Vec3.One.flatten(), Array_iterate(4, (i) => Vec3.One.flatten()));
                const bufferVertexLight = createBuffer(rgVertexLight, 3);

                loadAttribBuffer(programFlat['aVertexPosition'], bufferVertexPosition);
                loadAttribBuffer(programFlat['aVertexLight'], bufferVertexLight);

                gl.uniform4f(programFlat['light'], 1, 1, 1, 1);
                gl.drawArrays(gl.LINE_STRIP, this.iVertex, 5);
                gl.enable(gl.DEPTH_TEST);

                gl.deleteBuffer(bufferVertexPosition);
                gl.deleteBuffer(bufferVertexLight);
            }
            */
            return;
        }
        // fWireframe = false;
        if (!this.program) {
            return;
        }
        var program = this.program;
        /*
        if (_cubeDebug)
        {
            if (_cubeDebug === this.cube)
            {
                if (this.index === _iTriView)
                {
                    return;
                }
            }
            program = programSingle;
        }
        */
        useProgram(program);
        var alpha = 1;
        var wall = this.wall;
        if (wall && wall.type === WallTypes.CLOAKED) {
            alpha = 1 - wall.cloak_value;
            if (alpha === 0) {
                return;
            }
        }
        if (program.alphaValue !== alpha) {
            program.alphaValue = alpha;
            gl.uniform1f(program.alpha, alpha);
        }
        var slideU = 0;
        var slideV = 0;
        var sideL = 0;
        var tmi = this.tmi1;
        if (tmi) {
            slideU = (tmi.slide_u * time) % 4;
            slideV = (tmi.slide_v * time) % 4;
            /*
            // TODO check tex2
            if (tmi.lighting)
            {
                const light = this.light;
                if (light && light.timer !== (1 << 31))
                {
                    const lightTime = time / light.delay;
                    const lightBit = lightTime % 31;
                    const fLit = light.mask & (1 << lightBit);
                    if (fLit)
                        sideL = .5;
                }
            }
            */
        }
        if (program.slideU !== slideU || program.slideV !== slideV) {
            program.slideU = slideU;
            program.slideV = slideV;
            gl.uniform2f(program.slide, slideU, slideV);
        }
        gl.uniform2f(program.slide, slideU, slideV);
        bindTexture(1, tmi.loadTexture(1).tex);
        var tmi2 = this.tmi2;
        if (tmi2) {
            var iOrient = this.tex2Orient;
            if (program._iOrient !== iOrient) {
                program._iOrient = iOrient;
                var matOrient = _rgOrientMatrices[iOrient];
                gl.uniformMatrix3fv(program.matOrientTex2, false, matOrient.flatten());
            }
            bindTexture(2, tmi2.loadTexture(2).tex);
        }
        var vertexOffset = this.vertexOffset;
        if (this.updateBrightness) {
            this.updateBrightness = false;
            var items = Side._updateBrightnessItems;
            for (var iVertex = 4; iVertex--;) {
                items[iVertex] = this.rgDeltaLight[(vertexOffset + iVertex) % 4] * this.rgL[(vertexOffset + iVertex) % 4] * this.brightness;
            }
            updateDynamicBuffer(_bufferVertexTextureBrightness, this.iVertex * 4, items);
        }
        if (this.updateLight) {
            this.updateLight = false;
            var items = Side._updateLightItems;
            for (var iVertex = 4; iVertex--;) {
                var light = this.rgVertexLight[(vertexOffset + iVertex) % 4];
                if (light) {
                    items[iVertex * 3 + 0] = light.x;
                    items[iVertex * 3 + 1] = light.y;
                    items[iVertex * 3 + 2] = light.z;
                }
                else {
                    items[iVertex * 3 + 0] = items[iVertex * 3 + 1] = items[iVertex * 3 + 2] = 0;
                }
            }
            updateDynamicBuffer(_bufferVertexLight, this.iVertex * 4 * 3, items);
        }
        if (fWireframe) {
            gl.drawArrays(gl.LINE_LOOP, this.iVertex, 4);
            gl.enable(gl.BLEND);
            // gl.disable(gl.DEPTH_TEST);
            gl.uniform1f(program.alpha, .4);
            gl.drawArrays(gl.TRIANGLE_FAN, this.iVertex, 4);
            gl.disable(gl.BLEND);
            // gl.enable(gl.DEPTH_TEST);
            gl.uniform1f(program.alpha, 1);
            /*
            gl.disable(gl.DEPTH_TEST);
            useProgram(programFlat);
            gl.uniform4f(programFlat['color'], 1, 1, 1, 1);
            gl.drawArrays(gl.LINE_STRIP, this.iVertex, 4);
            gl.enable(gl.DEPTH_TEST);
            */
        }
        else {
            gl.drawArrays(gl.TRIANGLE_FAN, this.iVertex, 4);
        }
    };
    Side.prototype.getPixel = function (u, v) {
        return this.tmi1.getPixel(u, v);
    };
    Side.prototype.getPixel2 = function (u, v) {
        var tmi2 = this.tmi2;
        if (!tmi2) {
            throw new Error();
        }
        var iOrient = this.tex2Orient;
        var matOrient = _rgOrientMatrices[iOrient];
        var uv = matOrient.multiply(new Vec3(u, v, 1));
        return tmi2.getPixel(uv.x, uv.y);
    };
    Side.prototype.bounce = function (line, size) {
        /*
        if (this.neighbor && !this.isSolid())
            return;
        */
        if (!this.isSolid()) {
            size = 0;
        }
        var bestBounce = null;
        for (var iTri = 2; iTri--;) {
            var tri = this.rgTriangles[iTri];
            var bounce = tri.bounce(line, size);
            if (bounce) {
                if (!bestBounce || bestBounce.distance > bounce.distance) {
                    bestBounce = bounce;
                    bestBounce.iTri = iTri;
                }
            }
        }
        if (bestBounce) {
            bestBounce.side = this;
        }
        return bestBounce;
    };
    Side.prototype.checkExit = function (line) {
        if (!this.neighbor) { // || this.isVisible ())
            return null;
        }
        for (var iTri = 2; iTri--;) {
            var tri = this.rgTriangles[iTri];
            var bounce = tri.bounce(line, 0);
            if (bounce) {
                return bounce;
            }
        }
        return null;
    };
    Side.prototype.getTextureLighting = function () {
        var lighting = 0;
        if (this.tmi1) {
            lighting += this.tmi1.lighting;
        }
        if (this.tmi2) {
            lighting += this.tmi2.lighting;
        }
        return lighting;
    };
    Side.prototype.setTex1 = function (tex) {
        this.tex1 = tex;
        this.tmi1 = _ham.rgTMapInfos[tex];
    };
    Side.prototype.setTex2 = function (tex, fOrient) {
        if (fOrient) {
            this.tex2Orient = (tex >> 14) & 3;
            tex = tex & 0x3fff;
        }
        this.tex2 = tex;
        this.tmi2 = _ham.rgTMapInfos[tex];
        // const lighting = this.getTextureLighting();
        // this.setStaticLight(lighting);
    };
    Side.prototype.setStaticLight = function (value) {
        var prev = this.static_light;
        this.static_light = value;
        this.cube.addStaticLight(value - prev);
    };
    Side.prototype.setDeltaLight = function (value) {
        var light = this.deltaLight;
        var diff = value - light;
        if (diff === 0) {
            return;
        }
        this.deltaLight = value;
        var rgDeltaLights = this.rgDeltaLights;
        if (rgDeltaLights) {
            for (var iDeltaLight = rgDeltaLights.length; iDeltaLight--;) {
                var dl = rgDeltaLights[iDeltaLight];
                var litSide = dl.side;
                litSide.applyDeltaLight(dl, diff);
            }
        }
    };
    Side.prototype.applyDeltaLight = function (light, diff) {
        var rgDeltaLight = this.rgDeltaLight;
        var sum = 0;
        for (var iVertex = 4; iVertex--;) {
            var vertLight = light.vert_light[iVertex];
            sum += vertLight;
            rgDeltaLight[iVertex] += diff * vertLight;
        }
        var avg = sum / 4;
        console.log("CUBE:", this.cube.index, "SIDE:", this.index, "light:", avg * diff);
        this.updateBrightness = true;
    };
    Side.prototype.setBrightness = function (value) {
        this.brightness = value;
        this.updateBrightness = true;
    };
    Side.prototype.getDoorwayFlags = function () {
        if (!this.neighbor) {
            return WID.RENDER;
        }
        var wall = this.wall;
        if (!wall) {
            return WID.NO_WALL;
        }
        return wall.getDoorwayFlags();
    };
    Side._updateBrightnessItems = new Float32Array(4);
    Side._updateLightItems = new Float32Array(4 * 3);
    return Side;
}());
var FlickeringLight = /** @class */ (function () {
    function FlickeringLight() {
    }
    FlickeringLight.prototype.load = function (stream) {
        this.segnum = stream.getInt16();
        this.sidenum = stream.getInt16();
        this.mask = stream.getInt32();
        this.timer = stream.getFixed();
        this.delay = stream.getFixed();
        return this;
    };
    return FlickeringLight;
}());
var WallTypes;
(function (WallTypes) {
    WallTypes[WallTypes["NORMAL"] = 0] = "NORMAL";
    WallTypes[WallTypes["BLASTABLE"] = 1] = "BLASTABLE";
    WallTypes[WallTypes["DOOR"] = 2] = "DOOR";
    WallTypes[WallTypes["ILLUSION"] = 3] = "ILLUSION";
    WallTypes[WallTypes["OPEN"] = 4] = "OPEN";
    WallTypes[WallTypes["CLOSED"] = 5] = "CLOSED";
    WallTypes[WallTypes["OVERLAY"] = 6] = "OVERLAY";
    WallTypes[WallTypes["CLOAKED"] = 7] = "CLOAKED";
})(WallTypes || (WallTypes = {}));
var WallFlags;
(function (WallFlags) {
    WallFlags[WallFlags["BLASTED"] = 1] = "BLASTED";
    WallFlags[WallFlags["DOOR_OPENED"] = 2] = "DOOR_OPENED";
    WallFlags[WallFlags["DOOR_LOCKED"] = 8] = "DOOR_LOCKED";
    WallFlags[WallFlags["DOOR_AUTO"] = 16] = "DOOR_AUTO";
    WallFlags[WallFlags["ILLUSION_OFF"] = 32] = "ILLUSION_OFF";
    WallFlags[WallFlags["WALL_SWITCH"] = 64] = "WALL_SWITCH";
    WallFlags[WallFlags["BUDDY_PROOF"] = 128] = "BUDDY_PROOF";
})(WallFlags || (WallFlags = {}));
var DoorStates;
(function (DoorStates) {
    DoorStates[DoorStates["CLOSED"] = 0] = "CLOSED";
    DoorStates[DoorStates["OPENING"] = 1] = "OPENING";
    DoorStates[DoorStates["WAITING"] = 2] = "WAITING";
    DoorStates[DoorStates["CLOSING"] = 3] = "CLOSING";
    DoorStates[DoorStates["OPEN"] = 4] = "OPEN";
    DoorStates[DoorStates["CLOAKING"] = 5] = "CLOAKING";
    DoorStates[DoorStates["DECLOAKING"] = 6] = "DECLOAKING";
})(DoorStates || (DoorStates = {}));
var DoorKeys;
(function (DoorKeys) {
    DoorKeys[DoorKeys["NONE"] = 1] = "NONE";
    DoorKeys[DoorKeys["BLUE"] = 2] = "BLUE";
    DoorKeys[DoorKeys["RED"] = 4] = "RED";
    DoorKeys[DoorKeys["GOLD"] = 8] = "GOLD";
})(DoorKeys || (DoorKeys = {}));
var DOOR_WAIT_TIME = 5;
var Wall = /** @class */ (function () {
    function Wall() {
        this._unique = (__unique++).toString();
    }
    Wall.prototype.load = function (stream) {
        this.segnum = stream.getUint32();
        this.sidenum = stream.getUint32();
        this.hps = stream.getFixed();
        this.linked_wall = stream.getInt32();
        this.type = stream.getUint8();
        this.flags = stream.getUint8();
        this.state = stream.getUint8();
        this.iTrigger = stream.getInt8();
        this.clip_num = stream.getUint8();
        this.keys = stream.getUint8();
        this.controlling_trigger = stream.getUint8();
        this.cloak_value = stream.getUint8();
        return this;
    };
    Wall.prototype.isVisible = function () {
        switch (this.type) {
            case WallTypes.OPEN:
                return false;
            case WallTypes.ILLUSION:
                return !(this.flags & WallFlags.ILLUSION_OFF);
            // case WallTypes.CLOAKED:
            // 	return true;	// TODO
        }
        return true;
    };
    Wall.prototype.isSolid = function () {
        switch (this.type) {
            case WallTypes.OPEN:
                return false;
            case WallTypes.ILLUSION:
                return !!(this.flags & WallFlags.ILLUSION_OFF);
            case WallTypes.BLASTABLE:
                return !(this.flags & WallFlags.BLASTED);
            case WallTypes.DOOR:
                return !(this.flags & WallFlags.DOOR_OPENED);
        }
        return true;
    };
    Wall.prototype.getDoorwayFlags = function () {
        switch (this.type) {
            case WallTypes.OPEN:
                return WID.NO_WALL;
            case WallTypes.ILLUSION:
                if (this.flags & WallFlags.ILLUSION_OFF) {
                    return WID.NO_WALL;
                }
                if (this.side.isTransparent()) {
                    return WID.TRANSILLUSORY_WALL;
                }
                return WID.ILLUSORY_WALL;
            case WallTypes.BLASTABLE:
                if (this.flags & WallFlags.BLASTED) {
                    return WID.TRANSILLUSORY_WALL;
                }
                break;
            case WallTypes.CLOAKED:
                return WID.RENDER | WID.RENDPAST | WID.CLOAKED;
            case WallTypes.DOOR:
                if (this.state === DoorStates.OPENING) {
                    return WID.TRANSPARENT_WALL;
                }
                break;
        }
        if (this.flags & WallFlags.DOOR_OPENED) {
            return WID.TRANSILLUSORY_WALL;
        }
        if (this.side.isTransparent()) {
            return WID.TRANSPARENT_WALL;
        }
        return WID.WALL;
    };
    Wall.prototype.damage = function (time, damage) {
        if (this.type !== WallTypes.BLASTABLE) {
            return;
        }
        if (this.flags & WallFlags.BLASTED) {
            return;
        }
        if (this.hps < 0) {
            return;
        }
        this.hps -= damage;
        var wclip = _ham.rgWClips[this.clip_num];
        var cFrames = wclip.num_frames;
        if (this.hps < 100 / cFrames) {
            // blast blastable
            this.blast(time);
        }
        else {
            // wall_set_tmap_num
            var iFrame = Math.floor((cFrames - 1) * (100 - this.hps) / (100 - 100 / cFrames + 1));
            wclip.apply(this.side, iFrame);
        }
    };
    Wall.prototype.blast = function (time) {
        this.hps = -1;
        var wclip = _ham.rgWClips[this.clip_num];
        if (wclip.flags & WClipFlags.EXPLODES) {
            this.explode(time);
        }
        else {
            var wclip_1 = _ham.rgWClips[this.clip_num];
            wclip_1.apply(this.side, wclip_1.num_frames - 1);
            this.flags |= WallFlags.BLASTED;
            if (this.otherWall) {
                this.otherWall.flags |= WallFlags.BLASTED;
            }
        }
    };
    Wall.prototype.explode = function (time) {
        ExplodingWall.add(new ExplodingWall(time, this));
        _ham.playSound(SoundFile_Sounds.EXPLODING_WALL, this.side.center);
    };
    Wall.prototype.openDoor = function () {
        var wclip = _ham.rgWClips[this.clip_num];
        switch (this.state) {
            default:
                this.time = 0;
                _rgActiveDoors.push(this);
                break;
            case DoorStates.CLOSING:
                this.time = wclip.play_time - this.time;
                break;
            case DoorStates.OPENING:
            case DoorStates.WAITING:
            case DoorStates.OPEN:
                return;
        }
        this.state = this.side.otherSide.wall.state = DoorStates.OPENING;
        if (wclip.open_sound >= 0) {
            _ham.playSound(wclip.open_sound, this.side.center);
        }
    };
    Wall.prototype.updateDoor = function (time, frameTime) {
        var fActive = true;
        var wclip = _ham.rgWClips[this.clip_num];
        switch (this.state) {
            case DoorStates.OPENING:
                this.time += frameTime;
                if (this.time > wclip.play_time / 2) {
                    this.flags |= WallFlags.DOOR_OPENED;
                    if (this.otherWall) {
                        this.otherWall.flags |= WallFlags.DOOR_OPENED;
                    }
                }
                var cFrames = wclip.num_frames;
                var iFrame = Math.floor(cFrames * this.time / wclip.play_time);
                if (iFrame >= cFrames - 1) {
                    iFrame = cFrames - 1;
                    if (this.flags & WallFlags.DOOR_AUTO) {
                        this.state = DoorStates.WAITING;
                        if (this.otherWall) {
                            this.otherWall.state = DoorStates.WAITING;
                        }
                        this.time = 0;
                    }
                    else {
                        this.state = DoorStates.OPEN;
                        if (this.otherWall) {
                            this.otherWall.state = DoorStates.OPEN;
                        }
                        fActive = false;
                    }
                }
                wclip.apply(this.side, iFrame);
                break;
            case DoorStates.CLOSING:
                {
                    if (this.time === 0) {
                        if (wclip.close_sound >= 0) {
                            _ham.playSound(wclip.close_sound, this.side.center);
                        }
                    }
                    this.time += frameTime;
                    if (this.time > wclip.play_time / 2) {
                        this.flags &= ~WallFlags.DOOR_OPENED;
                        if (this.otherWall) {
                            this.otherWall.flags &= ~WallFlags.DOOR_OPENED;
                        }
                    }
                    var cFrames_1 = wclip.num_frames;
                    var iFrame_1 = cFrames_1 - 1 - Math.floor(cFrames_1 * this.time / wclip.play_time);
                    if (iFrame_1 <= 0) {
                        iFrame_1 = 0;
                        this.state = DoorStates.CLOSED;
                        if (this.otherWall) {
                            this.otherWall.state = DoorStates.CLOSED;
                        }
                        fActive = false;
                    }
                    wclip.apply(this.side, iFrame_1);
                    break;
                }
            case DoorStates.WAITING:
                this.time += frameTime;
                if (this.time > DOOR_WAIT_TIME) {
                    this.time = 0;
                    this.state = DoorStates.CLOSING;
                    if (this.otherWall) {
                        this.otherWall.state = DoorStates.CLOSING;
                    }
                }
                break;
            case DoorStates.OPEN:
            case DoorStates.CLOSED:
                break;
            default:
                throw new Error("invalid door state: " + this.state);
        }
        return fActive;
    };
    return Wall;
}());
var EXPL_WALL_TOTAL_FIREBALLS = 32;
var EXPL_WALL_FIREBALL_SIZE = fix(0x48000) * 6 / 10;
var EXPL_WALL_TIME = 1;
var ExplodingWall = /** @class */ (function () {
    function ExplodingWall(startTime, wall) {
        this.startTime = startTime;
        this.wall = wall;
        this.cFireballs = 0;
    }
    ExplodingWall.add = function (wall) {
        ExplodingWall._rgExplodingWalls.push(wall);
    };
    ExplodingWall.update = function (time) {
        for (var iEffect = ExplodingWall._rgExplodingWalls.length; iEffect--;) {
            var effect = ExplodingWall._rgExplodingWalls[iEffect];
            if (!effect.update(time)) {
                ExplodingWall._rgExplodingWalls.swapOut(iEffect);
            }
        }
    };
    ExplodingWall.prototype.update = function (time) {
        var duration = Math.min(time - this.startTime, EXPL_WALL_TIME);
        var cFireballs = EXPL_WALL_TOTAL_FIREBALLS * (duration / EXPL_WALL_TIME) * (duration / EXPL_WALL_TIME);
        var wall = this.wall;
        var side = wall.side;
        var cube = side.cube;
        var normal = side.rgTriangles[0].normal;
        var v0 = side.vertices[1];
        var u = side.vertices[0].sub(v0);
        var v = side.vertices[2].sub(v0);
        if (!(wall.flags & WallFlags.BLASTED) && duration > EXPL_WALL_TIME * 3 / 4) {
            wall.flags |= WallFlags.BLASTED;
            if (wall.otherWall) {
                wall.otherWall.flags |= WallFlags.BLASTED;
            }
            var wclip = _ham.rgWClips[wall.clip_num];
            wclip.apply(side, wclip.num_frames - 1);
        }
        for (var e = this.cFireballs; e < cFireballs; ++e) {
            var size = EXPL_WALL_FIREBALL_SIZE + (2 * EXPL_WALL_FIREBALL_SIZE * e / EXPL_WALL_TOTAL_FIREBALLS);
            var pos = v0.addScale(u, Math.random()).addScale(v, Math.random());
            var scale = size * (EXPL_WALL_TOTAL_FIREBALLS - e) / EXPL_WALL_TOTAL_FIREBALLS;
            if (e & 1) {
                scale = -scale;
            }
            pos = pos.addScale(normal, scale);
            if (true || e & 3) {
                cube.createExplosion(time, pos, size, KnownVClips.SMALL_EXPLOSION);
            }
        }
        this.cFireballs = cFireballs;
        return duration < EXPL_WALL_TIME;
    };
    ExplodingWall._rgExplodingWalls = [];
    return ExplodingWall;
}());
var MAX_WALLS_PER_LINK = 10;
var Trigger = /** @class */ (function () {
    function Trigger() {
    }
    Trigger.prototype.load = function (stream) {
        this.type = stream.getUint8();
        this.flags = stream.getUint8();
        this.num_links = stream.getUint8();
        this.pad = stream.getUint8();
        this.value = stream.getFixed();
        this.time = stream.getFixed();
        this.seg = stream.getUint16Array(MAX_WALLS_PER_LINK);
        this.side = stream.getUint16Array(MAX_WALLS_PER_LINK);
        // console.log(this.type);
        return this;
    };
    Trigger.prototype.trigger = function (obj, time, fShot) {
        if (!(obj.type === ItemTypes.PLAYER /* || obj is companion */)) {
            return;
        }
        if (this.flags & TriggerFlags.DISABLED) {
            return;
        }
        if (this.flags & TriggerFlags.ONE_SHOT) {
            this.flags |= TriggerFlags.DISABLED;
        }
        switch (this.type) {
            case TriggerTypes.EXIT:
                break;
            case TriggerTypes.OPEN_DOOR:
                for (var iSide = this.rgSides.length; iSide--;) {
                    var side = this.rgSides[iSide];
                    var wall = side.wall;
                    if (!wall) {
                        continue;
                    }
                    switch (wall.type) {
                        case WallTypes.BLASTABLE:
                            wall.blast(time);
                            break;
                        case WallTypes.DOOR:
                            if (wall.state === DoorStates.CLOSED) {
                                wall.openDoor();
                            }
                            break;
                    }
                }
                break;
            case TriggerTypes.OPEN_WALL:
                for (var iSide = this.rgSides.length; iSide--;) {
                    var side = this.rgSides[iSide];
                    var wall = side.wall;
                    if (side.tmi1.flags & TMapInfoFlags.FORCE_FIELD) {
                        wall.type = WallTypes.OPEN;
                        if (wall.otherWall) {
                            wall.otherWall.type = WallTypes.OPEN;
                        }
                        _ham.playSound(SoundFile_Sounds.FORCEFIELD_OFF, side.center);
                    }
                    else if (wall.type !== WallTypes.OPEN) {
                        switch (wall.state) {
                            case DoorStates.CLOAKING:
                                return;
                            case DoorStates.DECLOAKING:
                                var cloakingWall = notNull(wall.cloakingWall);
                                cloakingWall.reset(CLOAKING_WALL_TIME - cloakingWall.time);
                                break;
                            case DoorStates.CLOSED:
                                wall.cloakingWall = new CloakingWall(wall);
                                _rgCloakingWalls.push(wall.cloakingWall);
                                break;
                            default:
                                throw new Error("invalid door state");
                        }
                        _ham.playSound(SoundFile_Sounds.WALL_CLOAK_ON, side.center);
                    }
                }
                break;
            case TriggerTypes.LOCK_DOOR:
                for (var iSide = this.rgSides.length; iSide--;) {
                    var wall = this.rgSides[iSide].wall;
                    if (wall) {
                        wall.flags |= WallFlags.DOOR_LOCKED;
                    }
                }
                break;
            case TriggerTypes.UNLOCK_DOOR:
                for (var iSide = this.rgSides.length; iSide--;) {
                    var wall = this.rgSides[iSide].wall;
                    if (wall) {
                        wall.flags &= ~WallFlags.DOOR_LOCKED;
                        wall.keys = 0;
                    }
                }
                break;
            default:
                throw new Error("unsupported trigger type: " + this.type);
        }
    };
    return Trigger;
}());
var TriggerTypes;
(function (TriggerTypes) {
    TriggerTypes[TriggerTypes["OPEN_DOOR"] = 0] = "OPEN_DOOR";
    TriggerTypes[TriggerTypes["CLOSE_DOOR"] = 1] = "CLOSE_DOOR";
    TriggerTypes[TriggerTypes["MATCEN"] = 2] = "MATCEN";
    TriggerTypes[TriggerTypes["EXIT"] = 3] = "EXIT";
    TriggerTypes[TriggerTypes["SECRET_EXIT"] = 4] = "SECRET_EXIT";
    TriggerTypes[TriggerTypes["ILLUSION_OFF"] = 5] = "ILLUSION_OFF";
    TriggerTypes[TriggerTypes["ILLUSION_ON"] = 6] = "ILLUSION_ON";
    TriggerTypes[TriggerTypes["UNLOCK_DOOR"] = 7] = "UNLOCK_DOOR";
    TriggerTypes[TriggerTypes["LOCK_DOOR"] = 8] = "LOCK_DOOR";
    TriggerTypes[TriggerTypes["OPEN_WALL"] = 9] = "OPEN_WALL";
    TriggerTypes[TriggerTypes["CLOSE_WALL"] = 10] = "CLOSE_WALL";
    TriggerTypes[TriggerTypes["ILLUSORY_WALL"] = 11] = "ILLUSORY_WALL";
    TriggerTypes[TriggerTypes["LIGHT_OFF"] = 12] = "LIGHT_OFF";
    TriggerTypes[TriggerTypes["LIGHT_ON"] = 13] = "LIGHT_ON";
})(TriggerTypes || (TriggerTypes = {}));
var TriggerFlags;
(function (TriggerFlags) {
    TriggerFlags[TriggerFlags["NO_MESSAGE"] = 1] = "NO_MESSAGE";
    TriggerFlags[TriggerFlags["ONE_SHOT"] = 2] = "ONE_SHOT";
    TriggerFlags[TriggerFlags["DISABLED"] = 4] = "DISABLED";
})(TriggerFlags || (TriggerFlags = {}));
var _rgCloakingWalls = [];
var CloakingWall = /** @class */ (function () {
    function CloakingWall(wall) {
        this.wall = wall;
        wall.state = DoorStates.CLOAKING;
        if (wall.otherWall) {
            wall.otherWall.state = DoorStates.CLOAKING;
        }
        this.reset(0);
    }
    CloakingWall.update = function (frameTime) {
        for (var iCloakingWall = _rgCloakingWalls.length; iCloakingWall--;) {
            var cloakingWall = _rgCloakingWalls[iCloakingWall];
            if (!cloakingWall.update(frameTime)) {
                cloakingWall.wall.cloakingWall = null;
                _rgCloakingWalls.swapOut(iCloakingWall);
            }
        }
    };
    CloakingWall.prototype.reset = function (time) {
        this.time = time;
    };
    CloakingWall.prototype.updateLight = function (scale) {
        // console.log("updateLight: " + scale);
        var wall = this.wall;
        wall.side.setBrightness(scale);
        if (wall.otherWall) {
            wall.otherWall.side.setBrightness(scale);
        }
    };
    CloakingWall.prototype.update = function (frameTime) {
        this.time += frameTime;
        var wall = this.wall;
        var otherWall = wall.otherWall;
        // console.log("time: " + this.time);
        if (this.time > CLOAKING_WALL_TIME) {
            if (wall.state === DoorStates.CLOAKING) {
                wall.type = WallTypes.OPEN;
                if (otherWall) {
                    otherWall.type = WallTypes.OPEN;
                }
            }
            this.updateLight(1);
            wall.state = DoorStates.CLOSED;
            if (otherWall) {
                otherWall.state = DoorStates.CLOSED;
            }
            return false;
        }
        else if (this.time > CLOAKING_WALL_TIME / 2) {
            var light_scale = 2 * this.time / CLOAKING_WALL_TIME - 1;
            if (light_scale > 1) {
                light_scale = 1;
            }
            if (wall.state === DoorStates.CLOAKING) {
                wall.cloak_value = light_scale;
                if (otherWall) {
                    otherWall.cloak_value = light_scale;
                }
                if (wall.type !== WallTypes.CLOAKED) {
                    wall.type = WallTypes.CLOAKED;
                    if (otherWall) {
                        otherWall.type = WallTypes.CLOAKED;
                    }
                }
            }
            else {
                wall.type = WallTypes.OPEN;
                if (otherWall) {
                    otherWall.type = WallTypes.OPEN;
                }
                this.updateLight(light_scale);
            }
        }
        else {
            var light_scale = 1 - this.time * 2 / CLOAKING_WALL_TIME;
            if (light_scale < 0) {
                light_scale = 0;
            }
            if (wall.state === DoorStates.CLOAKING) {
                this.updateLight(light_scale);
            }
            else {
                wall.cloak_value = light_scale;
                if (otherWall) {
                    otherWall.cloak_value = light_scale;
                }
                wall.type = WallTypes.CLOAKED;
                if (otherWall) {
                    otherWall.type = WallTypes.CLOAKED;
                }
            }
        }
        return true;
    };
    return CloakingWall;
}());
var CLOAKING_WALL_TIME = 1;
var White = Vec3.One;
var MAX_CONTROLCEN_LINKS = 10;
var ControlCenterTrigger = /** @class */ (function () {
    function ControlCenterTrigger() {
    }
    ControlCenterTrigger.prototype.load = function (stream) {
        this.num_links = stream.getInt16();
        this.seg = stream.getInt16Array(MAX_CONTROLCEN_LINKS);
        this.side = stream.getInt16Array(MAX_CONTROLCEN_LINKS);
        return this;
    };
    return ControlCenterTrigger;
}());
var RobotCenter = /** @class */ (function () {
    function RobotCenter() {
        this.robot_flags = [];
    }
    RobotCenter.prototype.load = function (stream) {
        this.robot_flags = [
            stream.getInt32(),
            stream.getInt32(),
        ];
        this.hit_points = stream.getFixed();
        this.interval = stream.getFixed();
        this.segnum = stream.getInt16();
        this.fuelcen_num = stream.getInt16();
        return this;
    };
    return RobotCenter;
}());
var DeltaLightIndex = /** @class */ (function () {
    function DeltaLightIndex() {
    }
    DeltaLightIndex.prototype.load = function (stream) {
        this.segnum = stream.getInt16();
        this.sidenum = stream.getUint8();
        this.count = stream.getUint8();
        this.index = stream.getInt16();
        return this;
    };
    return DeltaLightIndex;
}());
var DeltaLight = /** @class */ (function () {
    function DeltaLight() {
    }
    DeltaLight.prototype.load = function (stream) {
        this.segnum = stream.getInt16();
        this.sidenum = stream.getUint8();
        stream.position += 1; // dummy
        this.vert_light = [
            stream.getUint8() / (256 >> 3),
            stream.getUint8() / (256 >> 3),
            stream.getUint8() / (256 >> 3),
            stream.getUint8() / (256 >> 3),
        ];
        return this;
    };
    return DeltaLight;
}());
var PowerupTypes;
(function (PowerupTypes) {
    PowerupTypes[PowerupTypes["EXTRA_LIFE"] = 0] = "EXTRA_LIFE";
    PowerupTypes[PowerupTypes["ENERGY"] = 1] = "ENERGY";
    PowerupTypes[PowerupTypes["SHIELD_BOOST"] = 2] = "SHIELD_BOOST";
    PowerupTypes[PowerupTypes["LASER"] = 3] = "LASER";
    PowerupTypes[PowerupTypes["KEY_BLUE"] = 4] = "KEY_BLUE";
    PowerupTypes[PowerupTypes["KEY_RED"] = 5] = "KEY_RED";
    PowerupTypes[PowerupTypes["KEY_GOLD"] = 6] = "KEY_GOLD";
    PowerupTypes[PowerupTypes["MISSILE_1"] = 10] = "MISSILE_1";
    PowerupTypes[PowerupTypes["MISSILE_4"] = 11] = "MISSILE_4";
    PowerupTypes[PowerupTypes["QUAD_FIRE"] = 12] = "QUAD_FIRE";
    PowerupTypes[PowerupTypes["VULCAN_WEAPON"] = 13] = "VULCAN_WEAPON";
    PowerupTypes[PowerupTypes["SPREADFIRE_WEAPON"] = 14] = "SPREADFIRE_WEAPON";
    PowerupTypes[PowerupTypes["PLASMA_WEAPON"] = 15] = "PLASMA_WEAPON";
    PowerupTypes[PowerupTypes["FUSION_WEAPON"] = 16] = "FUSION_WEAPON";
    PowerupTypes[PowerupTypes["PROXIMITY_WEAPON"] = 17] = "PROXIMITY_WEAPON";
    PowerupTypes[PowerupTypes["SMARTBOMB_WEAPON"] = 20] = "SMARTBOMB_WEAPON";
    PowerupTypes[PowerupTypes["MEGA_WEAPON"] = 21] = "MEGA_WEAPON";
    PowerupTypes[PowerupTypes["VULCAN_AMMO"] = 22] = "VULCAN_AMMO";
    PowerupTypes[PowerupTypes["HOMING_AMMO_1"] = 18] = "HOMING_AMMO_1";
    PowerupTypes[PowerupTypes["HOMING_AMMO_4"] = 19] = "HOMING_AMMO_4";
    PowerupTypes[PowerupTypes["CLOAK"] = 23] = "CLOAK";
    PowerupTypes[PowerupTypes["TURBO"] = 24] = "TURBO";
    PowerupTypes[PowerupTypes["INVULNERABILITY"] = 25] = "INVULNERABILITY";
    PowerupTypes[PowerupTypes["MEGAWOW"] = 27] = "MEGAWOW";
    PowerupTypes[PowerupTypes["GAUSS_WEAPON"] = 28] = "GAUSS_WEAPON";
    PowerupTypes[PowerupTypes["HELIX_WEAPON"] = 29] = "HELIX_WEAPON";
    PowerupTypes[PowerupTypes["PHOENIX_WEAPON"] = 30] = "PHOENIX_WEAPON";
    PowerupTypes[PowerupTypes["OMEGA_WEAPON"] = 31] = "OMEGA_WEAPON";
    PowerupTypes[PowerupTypes["SUPER_LASER"] = 32] = "SUPER_LASER";
    PowerupTypes[PowerupTypes["FULL_MAP"] = 33] = "FULL_MAP";
    PowerupTypes[PowerupTypes["CONVERTER"] = 34] = "CONVERTER";
    PowerupTypes[PowerupTypes["AMMO_RACK"] = 35] = "AMMO_RACK";
    PowerupTypes[PowerupTypes["AFTERBURNER"] = 36] = "AFTERBURNER";
    PowerupTypes[PowerupTypes["HEADLIGHT"] = 37] = "HEADLIGHT";
    PowerupTypes[PowerupTypes["SMISSILE1_1"] = 38] = "SMISSILE1_1";
    PowerupTypes[PowerupTypes["SMISSILE1_4"] = 39] = "SMISSILE1_4";
    PowerupTypes[PowerupTypes["GUIDED_MISSILE_1"] = 40] = "GUIDED_MISSILE_1";
    PowerupTypes[PowerupTypes["GUIDED_MISSILE_4"] = 41] = "GUIDED_MISSILE_4";
    PowerupTypes[PowerupTypes["SMART_MINE"] = 42] = "SMART_MINE";
    PowerupTypes[PowerupTypes["MERCURY_MISSILE_1"] = 43] = "MERCURY_MISSILE_1";
    PowerupTypes[PowerupTypes["MERCURY_MISSILE_4"] = 44] = "MERCURY_MISSILE_4";
    PowerupTypes[PowerupTypes["EARTHSHAKER_MISSILE"] = 45] = "EARTHSHAKER_MISSILE";
    PowerupTypes[PowerupTypes["FLAG_BLUE"] = 46] = "FLAG_BLUE";
    PowerupTypes[PowerupTypes["FLAG_RED"] = 47] = "FLAG_RED";
    PowerupTypes[PowerupTypes["HOARD_ORB"] = 7] = "HOARD_ORB";
})(PowerupTypes || (PowerupTypes = {}));
var MAX_ENERGY = 200;
var MAX_SHIELDS = 200;
var VULCAN_AMMO_MAX = (392 * 4);
var VULCAN_WEAPON_AMMO_AMOUNT = 196;
var VULCAN_AMMO_AMOUNT = (49 * 2);
var GAUSS_WEAPON_AMMO_AMOUNT = 392;
var _difficultyLevel = 0;
var PlayerFlags;
(function (PlayerFlags) {
    PlayerFlags[PlayerFlags["INVULNERABLE"] = 1] = "INVULNERABLE";
    PlayerFlags[PlayerFlags["BLUE_KEY"] = 2] = "BLUE_KEY";
    PlayerFlags[PlayerFlags["RED_KEY"] = 4] = "RED_KEY";
    PlayerFlags[PlayerFlags["GOLD_KEY"] = 8] = "GOLD_KEY";
    PlayerFlags[PlayerFlags["FLAG"] = 16] = "FLAG";
    PlayerFlags[PlayerFlags["UNUSED"] = 32] = "UNUSED";
    PlayerFlags[PlayerFlags["MAP_ALL"] = 64] = "MAP_ALL";
    PlayerFlags[PlayerFlags["AMMO_RACK"] = 128] = "AMMO_RACK";
    PlayerFlags[PlayerFlags["CONVERTER"] = 256] = "CONVERTER";
    PlayerFlags[PlayerFlags["QUAD_LASERS"] = 512] = "QUAD_LASERS";
    PlayerFlags[PlayerFlags["CLOAKED"] = 1024] = "CLOAKED";
    PlayerFlags[PlayerFlags["AFTERBURNER"] = 2048] = "AFTERBURNER";
    PlayerFlags[PlayerFlags["HEADLIGHT"] = 4096] = "HEADLIGHT";
    PlayerFlags[PlayerFlags["HEADLIGHT_ON"] = 8192] = "HEADLIGHT_ON";
})(PlayerFlags || (PlayerFlags = {}));
var Player = /** @class */ (function () {
    function Player() {
        this.reset();
    }
    Player.prototype.reset = function () {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.keys = 0;
        this.shields = 100;
        this.energy = 100;
        this.laser_level = 0;
        this.flags = 0;
        this.primary_weapon = 0;
        this.primary_weapon_flags = 0;
        this.primary_ammo = [];
        this.vulcan_ammo = 0;
        this.secondary_weapon = 0;
        this.secondary_weapon_flags = 0;
        this.secondary_ammo = [];
    };
    Player.prototype.pickUpPowerup = function (idPowerupType) {
        var fAlreadyHave = false;
        if (PowerupPrimaryFlags[idPowerupType]) {
            fAlreadyHave = !!(this.primary_weapon_flags & PowerupPrimaryFlags[idPowerupType]);
        }
        else if (PowerupSecondaryFlags[idPowerupType]) {
            fAlreadyHave = !!(this.secondary_weapon_flags & PowerupSecondaryFlags[idPowerupType]);
        }
        else if (PowerupPlayerFlags[idPowerupType]) {
            fAlreadyHave = !!(this.flags & PowerupPlayerFlags[idPowerupType]);
        }
        switch (idPowerupType) {
            case PowerupTypes.EXTRA_LIFE:
                this.lives++;
                return true;
            case PowerupTypes.ENERGY:
                return this.pickUpEnergy();
            case PowerupTypes.SHIELD_BOOST:
                return this.pickUpShields();
            case PowerupTypes.LASER:
                if (this.laser_level < MAX_LASER_LEVEL) {
                    this.laser_level++;
                    return true;
                }
                break;
            // case PowerupTypes.SUPER_LASER:
            case PowerupTypes.SPREADFIRE_WEAPON:
            case PowerupTypes.PLASMA_WEAPON:
            case PowerupTypes.FUSION_WEAPON:
            case PowerupTypes.HELIX_WEAPON:
            case PowerupTypes.PHOENIX_WEAPON:
                return this.pickUpPrimary(idPowerupType);
            case PowerupTypes.VULCAN_WEAPON:
                return this.pickUpVulcan();
            case PowerupTypes.VULCAN_AMMO:
                return this.pickUpVulcanAmmo();
            case PowerupTypes.GAUSS_WEAPON:
                return this.pickUpGauss();
            case PowerupTypes.KEY_BLUE:
            case PowerupTypes.KEY_RED:
            case PowerupTypes.KEY_GOLD:
                if (!fAlreadyHave) {
                    this.flags |= PowerupPlayerFlags[idPowerupType];
                    return true;
                }
                break;
            case PowerupTypes.MISSILE_1:
            case PowerupTypes.SMARTBOMB_WEAPON:
            case PowerupTypes.MEGA_WEAPON:
            case PowerupTypes.SMISSILE1_1:
            case PowerupTypes.GUIDED_MISSILE_1:
            case PowerupTypes.MERCURY_MISSILE_1:
            case PowerupTypes.HOMING_AMMO_1:
            case PowerupTypes.EARTHSHAKER_MISSILE:
                return this.pickUpSecondary(idPowerupType, 1);
            case PowerupTypes.MISSILE_4:
            case PowerupTypes.PROXIMITY_WEAPON:
            case PowerupTypes.SMISSILE1_4:
            case PowerupTypes.GUIDED_MISSILE_4:
            case PowerupTypes.SMART_MINE:
            case PowerupTypes.MERCURY_MISSILE_4:
            case PowerupTypes.HOMING_AMMO_4:
                return this.pickUpSecondary(idPowerupType, 4);
            case PowerupTypes.QUAD_FIRE:
            case PowerupTypes.AMMO_RACK:
            case PowerupTypes.FULL_MAP:
            case PowerupTypes.CONVERTER:
            case PowerupTypes.HEADLIGHT:
            case PowerupTypes.AFTERBURNER:
            case PowerupTypes.INVULNERABILITY:
            case PowerupTypes.CLOAK:
                if (fAlreadyHave) {
                    return this.pickUpEnergy();
                }
                this.flags |= PowerupPlayerFlags[idPowerupType];
                return true;
            case PowerupTypes.OMEGA_WEAPON:
            case PowerupTypes.TURBO:
            case PowerupTypes.MEGAWOW:
                /* network
                case PowerupTypes.FLAG_BLUE:
                case PowerupTypes.FLAG_RED:
                case PowerupTypes.HOARD_ORB:
                */
                break;
        }
        return false;
    };
    Player.prototype.pickUpEnergy = function () {
        if (this.energy >= MAX_ENERGY) {
            return false;
        }
        var boost = 3 * (NDL - _difficultyLevel + 1);
        if (_difficultyLevel === 0) {
            boost += boost / 2;
        }
        this.energy = Math.min(this.energy + boost, MAX_ENERGY);
        return true;
    };
    Player.prototype.pickUpShields = function () {
        if (this.shields >= MAX_SHIELDS) {
            return false;
        }
        var boost = 3 + 3 * (NDL - _difficultyLevel);
        if (_difficultyLevel === 0) {
            boost += boost / 2;
        }
        this.shields = Math.min(this.shields + boost, MAX_SHIELDS);
        return true;
    };
    Player.prototype.pickUpPrimary = function (idPowerupType) {
        var iPrimary = PowerupPrimaryFlags[idPowerupType];
        if (this.primary_weapon_flags & (1 << iPrimary)) {
            return this.pickUpEnergy();
        }
        this.primary_weapon_flags |= (1 << iPrimary);
        return true;
    };
    Player.prototype.pickUpSecondary = function (idPowerupType, count) {
        var iSecondary = PowerupPrimaryFlags[idPowerupType];
        if (this.secondary_weapon_flags & (1 << iSecondary)) {
            var max = Player.secondary_ammo_max[iSecondary];
            if (this.flags & PlayerFlags.AMMO_RACK) {
                max *= 2;
            }
            if (this.secondary_ammo[iSecondary] >= max) {
                return false;
            }
            this.secondary_ammo[iSecondary] = Math.min(max, this.secondary_ammo[iSecondary] + count);
        }
        else {
            this.secondary_weapon_flags |= (1 << iSecondary);
            this.secondary_ammo[iSecondary] = 0;
        }
        return true;
    };
    Player.prototype.pickUpVulcan = function () {
        _player.primary_weapon_flags |= (1 << PrimaryWeaponIndex.VULCAN);
        return this.pickUpVulcanAmmo(VULCAN_WEAPON_AMMO_AMOUNT);
    };
    Player.prototype.pickUpGauss = function () {
        _player.primary_weapon_flags |= (1 << PrimaryWeaponIndex.GAUSS);
        return this.pickUpVulcanAmmo(GAUSS_WEAPON_AMMO_AMOUNT);
    };
    Player.prototype.pickUpVulcanAmmo = function (count) {
        if (count === void 0) { count = VULCAN_AMMO_AMOUNT; }
        if (this.vulcan_ammo >= VULCAN_AMMO_MAX) {
            return false;
        }
        this.vulcan_ammo = Math.min(this.vulcan_ammo + count, VULCAN_AMMO_MAX);
        return true;
    };
    Player.prototype.hasKeys = function (doorKeys) {
        var flags = this.flags;
        if ((doorKeys & DoorKeys.BLUE) && !(flags & PlayerFlags.BLUE_KEY)) {
            return false;
        }
        if ((doorKeys & DoorKeys.RED) && !(flags & PlayerFlags.RED_KEY)) {
            return false;
        }
        if ((doorKeys & DoorKeys.GOLD) && !(flags & PlayerFlags.GOLD_KEY)) {
            return false;
        }
        return true;
    };
    Player.secondary_ammo_max = [20, 10, 10, 5, 5, 20, 20, 15, 10, 10];
    return Player;
}());
var _player = new Player();
var PrimaryWeaponIndex;
(function (PrimaryWeaponIndex) {
    PrimaryWeaponIndex[PrimaryWeaponIndex["LASER"] = 0] = "LASER";
    PrimaryWeaponIndex[PrimaryWeaponIndex["VULCAN"] = 1] = "VULCAN";
    PrimaryWeaponIndex[PrimaryWeaponIndex["SPREADFIRE"] = 2] = "SPREADFIRE";
    PrimaryWeaponIndex[PrimaryWeaponIndex["PLASMA"] = 3] = "PLASMA";
    PrimaryWeaponIndex[PrimaryWeaponIndex["FUSION"] = 4] = "FUSION";
    PrimaryWeaponIndex[PrimaryWeaponIndex["SUPER_LASER"] = 5] = "SUPER_LASER";
    PrimaryWeaponIndex[PrimaryWeaponIndex["GAUSS"] = 6] = "GAUSS";
    PrimaryWeaponIndex[PrimaryWeaponIndex["HELIX"] = 7] = "HELIX";
    PrimaryWeaponIndex[PrimaryWeaponIndex["PHOENIX"] = 8] = "PHOENIX";
    PrimaryWeaponIndex[PrimaryWeaponIndex["OMEGA"] = 9] = "OMEGA";
})(PrimaryWeaponIndex || (PrimaryWeaponIndex = {}));
var PowerupPrimaryFlags = (function () {
    var rg = {};
    rg[PowerupTypes.LASER] = PrimaryWeaponIndex.LASER;
    rg[PowerupTypes.VULCAN_WEAPON] = PrimaryWeaponIndex.VULCAN;
    rg[PowerupTypes.SPREADFIRE_WEAPON] = PrimaryWeaponIndex.SPREADFIRE;
    rg[PowerupTypes.PLASMA_WEAPON] = PrimaryWeaponIndex.PLASMA;
    rg[PowerupTypes.FUSION_WEAPON] = PrimaryWeaponIndex.FUSION;
    rg[PowerupTypes.SUPER_LASER] = PrimaryWeaponIndex.SUPER_LASER;
    rg[PowerupTypes.GAUSS_WEAPON] = PrimaryWeaponIndex.GAUSS;
    rg[PowerupTypes.HELIX_WEAPON] = PrimaryWeaponIndex.HELIX;
    rg[PowerupTypes.PHOENIX_WEAPON] = PrimaryWeaponIndex.PHOENIX;
    rg[PowerupTypes.OMEGA_WEAPON] = PrimaryWeaponIndex.OMEGA;
    return rg;
})();
var SecondaryWeaponIndex;
(function (SecondaryWeaponIndex) {
    SecondaryWeaponIndex[SecondaryWeaponIndex["CONCUSSION"] = 0] = "CONCUSSION";
    SecondaryWeaponIndex[SecondaryWeaponIndex["HOMING"] = 1] = "HOMING";
    SecondaryWeaponIndex[SecondaryWeaponIndex["PROXIMITY"] = 2] = "PROXIMITY";
    SecondaryWeaponIndex[SecondaryWeaponIndex["SMART"] = 3] = "SMART";
    SecondaryWeaponIndex[SecondaryWeaponIndex["MEGA"] = 4] = "MEGA";
    SecondaryWeaponIndex[SecondaryWeaponIndex["SMISSILE1"] = 5] = "SMISSILE1";
    SecondaryWeaponIndex[SecondaryWeaponIndex["GUIDED"] = 6] = "GUIDED";
    SecondaryWeaponIndex[SecondaryWeaponIndex["SMART_MINE"] = 7] = "SMART_MINE";
    SecondaryWeaponIndex[SecondaryWeaponIndex["SMISSILE4"] = 8] = "SMISSILE4";
    SecondaryWeaponIndex[SecondaryWeaponIndex["SMISSILE5"] = 9] = "SMISSILE5";
})(SecondaryWeaponIndex || (SecondaryWeaponIndex = {}));
var PowerupSecondaryFlags = (function () {
    var rg = {};
    rg[PowerupTypes.MISSILE_1] = SecondaryWeaponIndex.CONCUSSION;
    rg[PowerupTypes.MISSILE_4] = SecondaryWeaponIndex.CONCUSSION;
    rg[PowerupTypes.HOMING_AMMO_1] = SecondaryWeaponIndex.HOMING;
    rg[PowerupTypes.HOMING_AMMO_4] = SecondaryWeaponIndex.HOMING;
    rg[PowerupTypes.PROXIMITY_WEAPON] = SecondaryWeaponIndex.PROXIMITY;
    rg[PowerupTypes.SMARTBOMB_WEAPON] = SecondaryWeaponIndex.SMART;
    rg[PowerupTypes.MEGA_WEAPON] = SecondaryWeaponIndex.MEGA;
    rg[PowerupTypes.SMISSILE1_1] = SecondaryWeaponIndex.SMISSILE1;
    rg[PowerupTypes.SMISSILE1_4] = SecondaryWeaponIndex.SMISSILE1;
    rg[PowerupTypes.GUIDED_MISSILE_1] = SecondaryWeaponIndex.GUIDED;
    rg[PowerupTypes.GUIDED_MISSILE_4] = SecondaryWeaponIndex.GUIDED;
    rg[PowerupTypes.SMART_MINE] = SecondaryWeaponIndex.SMART_MINE;
    rg[PowerupTypes.MERCURY_MISSILE_1] = SecondaryWeaponIndex.SMISSILE4;
    rg[PowerupTypes.MERCURY_MISSILE_4] = SecondaryWeaponIndex.SMISSILE4;
    rg[PowerupTypes.EARTHSHAKER_MISSILE] = SecondaryWeaponIndex.SMISSILE5;
    return rg;
})();
var PowerupPlayerFlags = (function () {
    var rg = {};
    rg[PowerupTypes.INVULNERABILITY] = PlayerFlags.INVULNERABLE;
    rg[PowerupTypes.KEY_BLUE] = PlayerFlags.BLUE_KEY;
    rg[PowerupTypes.KEY_RED] = PlayerFlags.RED_KEY;
    rg[PowerupTypes.KEY_GOLD] = PlayerFlags.GOLD_KEY;
    // rg[PowerupTypes.] = PlayerFlags.FLAG;
    // rg[PowerupTypes.] = PlayerFlags.UNUSED;
    rg[PowerupTypes.FULL_MAP] = PlayerFlags.MAP_ALL;
    rg[PowerupTypes.AMMO_RACK] = PlayerFlags.AMMO_RACK;
    rg[PowerupTypes.CONVERTER] = PlayerFlags.CONVERTER;
    rg[PowerupTypes.QUAD_FIRE] = PlayerFlags.QUAD_LASERS;
    rg[PowerupTypes.CLOAK] = PlayerFlags.CLOAKED;
    rg[PowerupTypes.AFTERBURNER] = PlayerFlags.AFTERBURNER;
    rg[PowerupTypes.HEADLIGHT] = PlayerFlags.HEADLIGHT;
    return rg;
})();
var KeyActions;
(function (KeyActions) {
    KeyActions[KeyActions["Forward"] = 0] = "Forward";
    KeyActions[KeyActions["Backward"] = 1] = "Backward";
    KeyActions[KeyActions["StrafeLeft"] = 2] = "StrafeLeft";
    KeyActions[KeyActions["StrafeRight"] = 3] = "StrafeRight";
    KeyActions[KeyActions["StrafeUp"] = 4] = "StrafeUp";
    KeyActions[KeyActions["StrafeDown"] = 5] = "StrafeDown";
    KeyActions[KeyActions["PitchUp"] = 6] = "PitchUp";
    KeyActions[KeyActions["PitchDown"] = 7] = "PitchDown";
    KeyActions[KeyActions["TurnLeft"] = 8] = "TurnLeft";
    KeyActions[KeyActions["TurnRight"] = 9] = "TurnRight";
    KeyActions[KeyActions["BankLeft"] = 10] = "BankLeft";
    KeyActions[KeyActions["BankRight"] = 11] = "BankRight";
    KeyActions[KeyActions["FirePrimary"] = 12] = "FirePrimary";
    KeyActions[KeyActions["FireSecondary"] = 13] = "FireSecondary";
    KeyActions[KeyActions["FireFlare"] = 14] = "FireFlare";
    KeyActions[KeyActions["Debug"] = 15] = "Debug";
    KeyActions[KeyActions["TriUp"] = 16] = "TriUp";
    KeyActions[KeyActions["TriDown"] = 17] = "TriDown";
    KeyActions[KeyActions["StepNext"] = 18] = "StepNext";
    KeyActions[KeyActions["StepBack"] = 19] = "StepBack";
    KeyActions[KeyActions["stepUp"] = 20] = "stepUp";
    KeyActions[KeyActions["stepDown"] = 21] = "stepDown";
    KeyActions[KeyActions["wireframe"] = 22] = "wireframe";
    KeyActions[KeyActions["lockDebug"] = 23] = "lockDebug";
    KeyActions[KeyActions["PrimaryLaser"] = 24] = "PrimaryLaser";
    KeyActions[KeyActions["PrimaryVulcan"] = 25] = "PrimaryVulcan";
    KeyActions[KeyActions["PrimarySpreadFire"] = 26] = "PrimarySpreadFire";
    KeyActions[KeyActions["PrimaryPlasma"] = 27] = "PrimaryPlasma";
    KeyActions[KeyActions["PrimaryFusion"] = 28] = "PrimaryFusion";
    KeyActions[KeyActions["SecondaryConcussion"] = 29] = "SecondaryConcussion";
    KeyActions[KeyActions["SecondaryHoming"] = 30] = "SecondaryHoming";
    KeyActions[KeyActions["SecondaryProximity"] = 31] = "SecondaryProximity";
    KeyActions[KeyActions["SecondarySmart"] = 32] = "SecondarySmart";
    KeyActions[KeyActions["SecondaryMega"] = 33] = "SecondaryMega";
})(KeyActions || (KeyActions = {}));
var KeyBinding = /** @class */ (function () {
    function KeyBinding(name, keyCode, debounce) {
        if (debounce === void 0) { debounce = false; }
        this.name = name;
        this.keyCode = keyCode;
        this.debounce = debounce;
        this.pressed = false;
    }
    return KeyBinding;
}());
var MOUSE_SENSITIVITY = 2;
var KeysType = /** @class */ (function () {
    function KeysType() {
        this._mouseDeltaX = 0;
        this._mouseDeltaY = 0;
        this.bindings =
            [
                new KeyBinding("forward", -1),
                new KeyBinding("backward", -3),
                new KeyBinding("strafe left", 83),
                new KeyBinding("strafe right", 68),
                new KeyBinding("strafe up", 32),
                new KeyBinding("strafe down", 18),
                new KeyBinding("pitch up", 0),
                new KeyBinding("pitch down", 0),
                new KeyBinding("turn left", 90),
                new KeyBinding("turn right", 88),
                new KeyBinding("bank left", 69),
                new KeyBinding("bank right", 87),
                new KeyBinding("fire primary", 65),
                new KeyBinding("fire secondary", 20),
                new KeyBinding("fire flare", 81),
                // new KeyBinding("afterburner", 16),
                new KeyBinding("debug", 66),
                new KeyBinding("tri up", 33, true),
                new KeyBinding("tri down", 34, true),
                new KeyBinding("step next", 39, true),
                new KeyBinding("step back", 37, true),
                new KeyBinding("step up", 38, true),
                new KeyBinding("step down", 40, true),
                new KeyBinding("wireframe", 9, true),
                new KeyBinding("lock debug", 16, true),
                new KeyBinding("(SUPER)LASER CANNON", 0x31, true),
                new KeyBinding("VULCAN/GAUSS CANNON", 0x32, true),
                new KeyBinding("SPREADFIRE/HELIX CANNON", 0x33, true),
                new KeyBinding("PLASMA/PHOENIX CANNON", 0x34, true),
                new KeyBinding("FUSION/OMEGA CANNON", 0x35, true),
                new KeyBinding("CONCUSSION/FLASH MISSILE", 0x36, true),
                new KeyBinding("HOMING/GUIDED MISSILE", 0x37, true),
                new KeyBinding("PROXIMITY BOMB/SMART MINE", 0x38, true),
                new KeyBinding("SMART/MERCURY MISSILE", 0x39, true),
                new KeyBinding("MEGA/EARTHSHAKER MISSILE", 0x30, true),
            ];
        this.mapBindings = {};
        for (var iBinding = this.bindings.length; iBinding--;) {
            var binding = this.bindings[iBinding];
            this.mapBindings[binding.keyCode.toString()] = binding;
            this.mapBindings[binding.name] = binding;
        }
        this.thrust = Vec3.Zero;
        this.rot = Vec3.Zero;
    }
    KeysType.prototype.reset = function () {
        for (var iBinding = this.bindings.length; iBinding--;) {
            this.bindings[iBinding].pressed = false;
        }
    };
    KeysType.prototype.keyDown = function (code) {
        var binding = this.mapBindings[code];
        if (binding) {
            if (!binding.pressed) {
                // console.log("DOWN: " + binding.name);
                binding.pressed = true;
            }
            return true;
        }
        else {
            console.log("DOWN: " + code);
            return false;
        }
    };
    KeysType.prototype.keyUp = function (code) {
        var binding = this.mapBindings[code];
        if (binding) {
            if (binding.pressed) {
                // console.log("UP: " + binding.name);
                binding.pressed = false;
            }
        }
    };
    KeysType.prototype.updateControls = function (frameTime) {
        var forwardThrust = 0;
        var sidewaysThrust = 0;
        var verticalThrust = 0;
        var pitchTime = 0;
        var headingTime = 0;
        var bankTime = 0;
        this.firePrimary = false;
        this.lockDebug = false;
        this.stepUp = false;
        this.stepDown = false;
        for (var iBinding = this.bindings.length; iBinding--;) {
            var binding = this.bindings[iBinding];
            if (!binding.pressed) {
                continue;
            }
            switch (binding.name) {
                case "strafe right":
                    sidewaysThrust = frameTime;
                    break;
                case "strafe left":
                    sidewaysThrust = -frameTime;
                    break;
                case "strafe up":
                    verticalThrust = frameTime;
                    break;
                case "strafe down":
                    verticalThrust = -frameTime;
                    break;
                case "forward":
                    forwardThrust = frameTime;
                    break;
                case "backward":
                    forwardThrust = -frameTime;
                    break;
                case "afterburner":
                    this.afterburner = true;
                    break;
                case "fire primary":
                    this.firePrimary = true;
                    break;
                case "pitch up":
                    pitchTime = frameTime;
                    break;
                case "pitch down":
                    pitchTime = -frameTime;
                    break;
                case "turn right":
                    headingTime = frameTime;
                    break;
                case "turn left":
                    headingTime = -frameTime;
                    break;
                case "bank right":
                    bankTime = frameTime;
                    break;
                case "bank left":
                    bankTime = -frameTime;
                    break;
                /*
                case "tri up":
                    if (_iTriView < 5)
                    {
                        _iTriView++;
                        _iStep = 0;
                    }
                    break;
                case "tri down":
                    if (_iTriView > 0)
                    {
                        _iTriView--;
                        _iStep = 0;
                    }
                    break;

                case "step next":
                    _iStep++;
                    break;
                case "step back":
                    if (_iStep > 0)
                        _iStep--;
                    break;
                */
                case "step up":
                    this.stepUp = true;
                    break;
                case "step down":
                    this.stepDown = true;
                    break;
                case "wireframe":
                    this.wireframe = !this.wireframe;
                    break;
                case "lock debug":
                    this.lockDebug = true;
                    break;
            }
            if (binding.debounce) {
                binding.pressed = false;
            }
        }
        headingTime += this._mouseDeltaX * frameTime * MOUSE_SENSITIVITY / 8;
        pitchTime -= this._mouseDeltaY * frameTime * MOUSE_SENSITIVITY / 8;
        if (headingTime > frameTime) {
            headingTime = frameTime;
        }
        else if (headingTime < -frameTime) {
            headingTime = -frameTime;
        }
        if (pitchTime > frameTime) {
            pitchTime = frameTime;
        }
        else if (pitchTime < -frameTime) {
            pitchTime = -frameTime;
        }
        this.thrust = new Vec3(sidewaysThrust, verticalThrust, forwardThrust);
        this.rot = new Vec3(pitchTime, headingTime, bankTime);
        this._mouseDeltaX = this._mouseDeltaY = 0;
    };
    return KeysType;
}());
var Keys = new KeysType();
var ItemTypes;
(function (ItemTypes) {
    ItemTypes[ItemTypes["WALL"] = 0] = "WALL";
    ItemTypes[ItemTypes["FIREBALL"] = 1] = "FIREBALL";
    ItemTypes[ItemTypes["ROBOT"] = 2] = "ROBOT";
    ItemTypes[ItemTypes["HOSTAGE"] = 3] = "HOSTAGE";
    ItemTypes[ItemTypes["PLAYER"] = 4] = "PLAYER";
    ItemTypes[ItemTypes["WEAPON"] = 5] = "WEAPON";
    ItemTypes[ItemTypes["CAMERA"] = 6] = "CAMERA";
    ItemTypes[ItemTypes["POWERUP"] = 7] = "POWERUP";
    ItemTypes[ItemTypes["DEBRIS"] = 8] = "DEBRIS";
    ItemTypes[ItemTypes["CNTRLCEN"] = 9] = "CNTRLCEN";
    ItemTypes[ItemTypes["FLARE"] = 10] = "FLARE";
    ItemTypes[ItemTypes["CLUTTER"] = 11] = "CLUTTER";
    ItemTypes[ItemTypes["GHOST"] = 12] = "GHOST";
    ItemTypes[ItemTypes["LIGHT"] = 13] = "LIGHT";
    ItemTypes[ItemTypes["COOP"] = 14] = "COOP";
    ItemTypes[ItemTypes["MARKER"] = 15] = "MARKER";
    ItemTypes[ItemTypes["NONE"] = 255] = "NONE";
})(ItemTypes || (ItemTypes = {}));
// misc object flags
var ItemFlags;
(function (ItemFlags) {
    ItemFlags[ItemFlags["EXPLODING"] = 1] = "EXPLODING";
    ItemFlags[ItemFlags["SHOULD_BE_DEAD"] = 2] = "SHOULD_BE_DEAD";
    ItemFlags[ItemFlags["DESTROYED"] = 4] = "DESTROYED";
    ItemFlags[ItemFlags["SILENT"] = 8] = "SILENT";
    ItemFlags[ItemFlags["ATTACHED"] = 16] = "ATTACHED";
    ItemFlags[ItemFlags["HARMLESS"] = 32] = "HARMLESS";
    ItemFlags[ItemFlags["PLAYER_DROPPED"] = 64] = "PLAYER_DROPPED";
})(ItemFlags || (ItemFlags = {}));
// Control types - what tells this CObject what do do
var ControlTypes;
(function (ControlTypes) {
    ControlTypes[ControlTypes["NONE"] = 0] = "NONE";
    ControlTypes[ControlTypes["AI"] = 1] = "AI";
    ControlTypes[ControlTypes["EXPLOSION"] = 2] = "EXPLOSION";
    ControlTypes[ControlTypes["FLYING"] = 4] = "FLYING";
    ControlTypes[ControlTypes["SLEW"] = 5] = "SLEW";
    ControlTypes[ControlTypes["FLYTHROUGH"] = 6] = "FLYTHROUGH";
    ControlTypes[ControlTypes["WEAPON"] = 9] = "WEAPON";
    ControlTypes[ControlTypes["REPAIRCEN"] = 10] = "REPAIRCEN";
    ControlTypes[ControlTypes["MORPH"] = 11] = "MORPH";
    ControlTypes[ControlTypes["DEBRIS"] = 12] = "DEBRIS";
    ControlTypes[ControlTypes["POWERUP"] = 13] = "POWERUP";
    ControlTypes[ControlTypes["LIGHT"] = 14] = "LIGHT";
    ControlTypes[ControlTypes["REMOTE"] = 15] = "REMOTE";
    ControlTypes[ControlTypes["CNTRLCEN"] = 16] = "CNTRLCEN";
    ControlTypes[ControlTypes["WAYPOINT"] = 17] = "WAYPOINT";
    ControlTypes[ControlTypes["CAMERA"] = 18] = "CAMERA";
})(ControlTypes || (ControlTypes = {}));
var MovementTypes;
(function (MovementTypes) {
    MovementTypes[MovementTypes["NONE"] = 0] = "NONE";
    MovementTypes[MovementTypes["PHYSICS"] = 1] = "PHYSICS";
    MovementTypes[MovementTypes["STATIC"] = 2] = "STATIC";
    MovementTypes[MovementTypes["SPINNING"] = 3] = "SPINNING";
})(MovementTypes || (MovementTypes = {}));
var RenderTypes;
(function (RenderTypes) {
    RenderTypes[RenderTypes["NONE"] = 0] = "NONE";
    RenderTypes[RenderTypes["POLYOBJ"] = 1] = "POLYOBJ";
    RenderTypes[RenderTypes["FIREBALL"] = 2] = "FIREBALL";
    RenderTypes[RenderTypes["LASER"] = 3] = "LASER";
    RenderTypes[RenderTypes["HOSTAGE"] = 4] = "HOSTAGE";
    RenderTypes[RenderTypes["POWERUP"] = 5] = "POWERUP";
    RenderTypes[RenderTypes["MORPH"] = 6] = "MORPH";
    RenderTypes[RenderTypes["WEAPON_VCLIP"] = 7] = "WEAPON_VCLIP";
    RenderTypes[RenderTypes["THRUSTER"] = 8] = "THRUSTER";
    RenderTypes[RenderTypes["EXPLBLAST"] = 9] = "EXPLBLAST";
    RenderTypes[RenderTypes["SHRAPNELS"] = 10] = "SHRAPNELS";
    RenderTypes[RenderTypes["SMOKE"] = 11] = "SMOKE";
    RenderTypes[RenderTypes["LIGHTNING"] = 12] = "LIGHTNING";
    RenderTypes[RenderTypes["SOUND"] = 13] = "SOUND";
    RenderTypes[RenderTypes["SHOCKWAVE"] = 14] = "SHOCKWAVE";
})(RenderTypes || (RenderTypes = {}));
var SpinnerInfo = /** @class */ (function () {
    function SpinnerInfo() {
        this.velocity = Vec3.Zero;
    }
    SpinnerInfo.prototype.load = function (view) {
        this.spin = view.getVector();
        this.spinMatrix = Mat3.fromEuler(this.spin);
        return this;
    };
    SpinnerInfo.prototype.move = function (obj, time, frameTime) {
        obj.orient = this.spinMatrix.scale(frameTime).multiply(obj.orient);
        return true;
    };
    return SpinnerInfo;
}());
var PhysicsInfo = /** @class */ (function () {
    function PhysicsInfo() {
        this.velocity = Vec3.Zero;
        this.thrust = Vec3.Zero;
        this.mass = 0;
        this.drag = 0;
        this.brakes = 0;
        this.rotvel = Vec3.Zero;
        this.rotthrust = Vec3.Zero;
        this.turnroll = 0;
        this.flags = 0;
    }
    PhysicsInfo.prototype.load = function (view) {
        this.velocity = view.getVector();
        this.thrust = view.getVector();
        this.mass = view.getFixed();
        this.drag = view.getFixed();
        this.brakes = view.getFixed();
        this.rotvel = view.getVector();
        this.rotthrust = view.getVector();
        this.turnroll = view.getFixed2();
        this.flags = view.getUint16();
        return this;
    };
    PhysicsInfo.prototype.move = function (obj, time, frameTime) {
        assert(!obj.isDead());
        if (this.drag) {
            var tau = this.mass * 2.5 * this.drag;
            var dragScale = Math.exp(-frameTime / tau);
            // linear drag equation
            this.rotvel = this.rotvel.scale(dragScale);
            if (this.flags & PhysicsFlags.USES_THRUST) {
                this.rotvel = this.rotvel.addScale(this.rotthrust, tau * (1 - dragScale) / frameTime);
            }
        }
        var orient = obj.orient;
        if (this.turnroll) {
            var turnmat = Mat3.fromEuler(0, 0, -this.turnroll);
            orient = orient.multiply(turnmat);
        }
        var tangles = Mat3.fromEuler(this.rotvel.scale(frameTime));
        orient = tangles.multiply(orient);
        if (this.flags & PhysicsFlags.TURNROLL) {
            var desired_bank = -this.rotvel.y * TURNROLL_SCALE;
            if (this.turnroll !== desired_bank) {
                var max_roll = frameTime * ROLL_RATE;
                var delta_ang = desired_bank - this.turnroll;
                if (Math.abs(delta_ang) < max_roll) {
                    max_roll = delta_ang;
                }
                else if (delta_ang < 0) {
                    max_roll = -max_roll;
                }
                this.turnroll += max_roll;
            }
        }
        if (this.turnroll) {
            var turnmat = Mat3.fromEuler(0, 0, this.turnroll);
            orient = orient.multiply(turnmat);
        }
        obj.orient = orient;
        if (this.drag) {
            var tau = this.mass * this.drag;
            var dragScale = Math.exp(-frameTime / tau);
            // linear drag equation
            this.velocity = this.velocity.scale(dragScale);
            if (this.flags & PhysicsFlags.USES_THRUST) {
                this.velocity = this.velocity.addScale(this.thrust, tau * (1 - dragScale) / frameTime);
            }
        }
        var fKill = false;
        if (this.velocity.len2() > 1e-15) {
            var move = this.velocity.scale(frameTime);
            // const distance = move.len2();
            assert(obj.iCube >= 0);
            /*
            if (!obj.cube.isPointInside(posNew))
            {
                console.log("NOT INSIDE");
                // return;
            }
            */
            var mapCollisionHandlers = Item.mapCollisionHandlers[obj.type];
            var cBounces = 3;
            var type = obj.type;
            var bounce = void 0;
            var sideExit = null;
            var cube = obj.cube;
            var pos = obj.pos;
            var posNew = pos.add(move);
            do {
                var line = new LineSegment(pos, posNew);
                // if (!(obj.type === ObjectTypes.PLAYER /*&& _cubeDebug*/))
                bounce = cube.bounce(line, obj.size + 0.01);
                var closestOther = null;
                var distanceToClosest = line.length; // Number.POSITIVE_INFINITY;
                if (mapCollisionHandlers) {
                    var rgObjects = cube._rgObjects;
                    for (var iOther = rgObjects.length; iOther--;) {
                        var other = rgObjects[iOther];
                        if (other.isDead()) {
                            continue;
                        } // item is dead
                        var otherType = other.type;
                        if (otherType === type) {
                            if (iOther >= obj.cubeIndex) {
                                continue;
                            }
                            if (other === obj) {
                                continue;
                            }
                        }
                        var collisionHandler = mapCollisionHandlers[otherType];
                        if (collisionHandler) {
                            var distanceToOther = line.distanceToSphere(other.pos, other.size + obj.size);
                            if (distanceToClosest > distanceToOther) {
                                distanceToClosest = distanceToOther;
                                closestOther = other;
                            }
                        }
                    }
                }
                if (closestOther && (!bounce || distanceToClosest < bounce.distance)) {
                    var collisionPoint = new LineSegment(line.proceed(distanceToClosest), closestOther.pos).proceed(obj.size);
                    // console.log(distanceToClosest);
                    var objRemove = mapCollisionHandlers[closestOther.type].call(obj, time, collisionPoint, closestOther);
                    if (objRemove) {
                        if (objRemove === obj) {
                            fKill = true;
                        }
                        else {
                            objRemove.link(null);
                        }
                    }
                }
                else if (bounce) {
                    var side = bounce.side;
                    var wall = side.wall;
                    if (!side.isSolid()) {
                        if (wall && wall.trigger) {
                            wall.trigger.trigger(obj, time, false);
                        }
                        cube = side.neighbor;
                        pos = bounce.anchor;
                    }
                    else {
                        switch (type) {
                            case ItemTypes.WEAPON:
                                var uv = null;
                                var tmi1 = side.tmi1;
                                if (side.neighbor && tmi1.isTransparent()) {
                                    if (!uv) {
                                        uv = bounce.getTextureCoords();
                                    }
                                    var color = side.getPixel(uv.x, uv.y);
                                    if (color === 255) {
                                        cube = side.neighbor;
                                        pos = bounce.anchor;
                                        break;
                                    }
                                }
                                var wi = obj.weaponInfo;
                                if (this.flags & PhysicsFlags.BOUNCE &&
                                    (!(this.flags & PhysicsFlags.BOUNCES_TWICE) || !(this.flags & PhysicsFlags.BOUNCED_ONCE))) {
                                    this.flags |= PhysicsFlags.BOUNCED_ONCE;
                                    var normalVelocity_1 = this.velocity.projectOnTo(bounce.normal);
                                    this.velocity = this.velocity.addScale(normalVelocity_1, -2);
                                    obj.orient = Mat3.createLook(this.velocity, obj.orient._[1]);
                                    pos = bounce.anchor;
                                    posNew = bounce.reflectPoint(posNew);
                                }
                                else {
                                    fKill = true;
                                    posNew = bounce.anchor;
                                    cube.createExplosion(time, posNew.addScale(side.normal, .1), wi.impact_size, wi.wall_hit_vclip);
                                    if (!wall && wi.wall_hit_sound >= 0) {
                                        _ham.playSound(wi.wall_hit_sound, posNew);
                                    }
                                }
                                var tmi2 = side.tmi2;
                                if (tmi2) {
                                    var ec = tmi2.eclip_num;
                                    var fBlow = false;
                                    var effect = (ec >= 0) ? _ham.rgEClips[ec] : null;
                                    if (effect) {
                                        fBlow = (effect.dest_bm_num >= 0 && !(effect.eflags & EClipFlags.ONE_SHOT));
                                    }
                                    else {
                                        fBlow = (tmi2.destroyed !== -1);
                                    }
                                    if (fBlow) {
                                        if (!uv) {
                                            uv = bounce.getTextureCoords();
                                        }
                                        var color = side.getPixel2(uv.x, uv.y);
                                        if (color !== 255) {
                                            side.setDeltaLight(0);
                                            if (effect) {
                                                if (effect.sound_num >= 0) {
                                                    _ham.playSound(effect.sound_num, posNew);
                                                }
                                                cube.createExplosion(time, posNew.addScale(side.normal, .1), effect.dest_size, effect.dest_vclip);
                                                if (effect.dest_eclip >= 0) {
                                                    var new_ec = _ham.rgEClips[effect.dest_eclip];
                                                    new_ec.time_left = new_ec.frame_time;
                                                    new_ec.frame_count = 0;
                                                    new_ec.segnum = cube.index;
                                                    new_ec.sidenum = side.index;
                                                    new_ec.eflags |= EClipFlags.ONE_SHOT;
                                                    new_ec.dest_bm_num = effect.dest_bm_num;
                                                    side.setTex2(new_ec.changing_wall_texture); // replace with destoyed
                                                }
                                                else {
                                                    side.setTex2(effect.dest_bm_num);
                                                }
                                            }
                                            else {
                                                cube.createExplosion(time, posNew.addScale(side.normal, .1), 20, 3);
                                                side.setTex2(tmi2.destroyed);
                                                _ham.playSound(SoundFile_Sounds.LIGHT_BLOWNUP, posNew);
                                            }
                                            if (wall && wall.trigger) {
                                                wall.trigger.trigger(obj.parent, time, true);
                                            }
                                        }
                                    }
                                }
                                if (wall) {
                                    switch (wall.type) {
                                        case WallTypes.BLASTABLE:
                                            wall.damage(time, obj.shields);
                                            if (wi.wall_hit_sound >= 0) {
                                                _ham.playSound(SoundFile_Sounds.WEAPON_HIT_BLASTABLE, posNew);
                                            }
                                            break;
                                        case WallTypes.DOOR:
                                            if (obj.parent && obj.parent.type === ItemTypes.PLAYER) {
                                                if (_player.hasKeys(wall.keys) && !(wall.flags & WallFlags.DOOR_LOCKED)) {
                                                    if (wall.state !== DoorStates.OPENING) {
                                                        wall.openDoor();
                                                    }
                                                }
                                                else {
                                                    _ham.playSound(SoundFile_Sounds.WEAPON_HIT_DOOR, posNew);
                                                }
                                            }
                                            break;
                                        default:
                                            if (wi.wall_hit_sound >= 0) {
                                                _ham.playSound(wi.wall_hit_sound, posNew);
                                            }
                                            break;
                                    }
                                }
                                break;
                            default:
                                var normalVelocity = this.velocity.projectOnTo(bounce.normal);
                                this.velocity = this.velocity.sub(normalVelocity);
                                pos = bounce.anchor;
                                posNew = bounce.reflectPoint(posNew);
                                break;
                        }
                    }
                }
            } while (cBounces-- > 0 && (bounce || sideExit));
            if (!cube.isPointInside(posNew)) {
                cube.isPointInside(posNew);
                cube.bounce(new LineSegment(pos, posNew), 0);
                // find closest point
                var lineFix = new LineSegment(cube.center, posNew);
                var bounceFix = cube.bounce(lineFix, obj.size);
                if (bounceFix) {
                    posNew = bounceFix.anchor;
                }
                else {
                    posNew = null;
                } // last resort, don't move
            }
            if (posNew) {
                obj.pos = posNew;
                obj.link(cube);
            }
        }
        return !fKill; // stay alive
    };
    return PhysicsInfo;
}());
var PhysicsFlags;
(function (PhysicsFlags) {
    PhysicsFlags[PhysicsFlags["TURNROLL"] = 1] = "TURNROLL";
    PhysicsFlags[PhysicsFlags["LEVELLING"] = 2] = "LEVELLING";
    PhysicsFlags[PhysicsFlags["BOUNCE"] = 4] = "BOUNCE";
    PhysicsFlags[PhysicsFlags["WIGGLE"] = 8] = "WIGGLE";
    PhysicsFlags[PhysicsFlags["STICK"] = 16] = "STICK";
    PhysicsFlags[PhysicsFlags["PERSISTENT"] = 32] = "PERSISTENT";
    PhysicsFlags[PhysicsFlags["USES_THRUST"] = 64] = "USES_THRUST";
    PhysicsFlags[PhysicsFlags["BOUNCED_ONCE"] = 128] = "BOUNCED_ONCE";
    PhysicsFlags[PhysicsFlags["FREE_SPINNING"] = 256] = "FREE_SPINNING";
    PhysicsFlags[PhysicsFlags["BOUNCES_TWICE"] = 512] = "BOUNCES_TWICE";
})(PhysicsFlags || (PhysicsFlags = {}));
var PolygonRenderInfo = /** @class */ (function () {
    function PolygonRenderInfo(model_num) {
        this.model_num = model_num;
        this.subobj_flags = 0;
        this.alt_textures = 0;
        this.tmap_override = 0;
    }
    PolygonRenderInfo.prototype.load = function (view) {
        this.model_num = view.getUint32();
        this.rgAnimAngles = view.getVector2Array(MAX_SUBMODELS);
        this.subobj_flags = view.getUint32();
        this.tmap_override = view.getInt32();
        return this;
    };
    PolygonRenderInfo.prototype.render = function (obj, time) {
        var pos = obj.pos;
        var orient = obj.orient;
        var lightValue = obj.cube.static_light;
        var light = new Vec3(lightValue, lightValue, lightValue);
        var model = _ham.rgPolygonModels[this.model_num];
        pushOrientMatrix(orient, pos);
        var flags = this.subobj_flags;
        if (flags) {
            for (var i = 0; flags; flags >>= 1, ++i) {
                if (flags & 1) {
                    var ofs = model.submodel_mins[i].add(model.submodel_maxs[i]).scale(.5);
                    // push matrix
                    model.render(light, this.rgAnimAngles);
                    // pop matrix
                }
            }
        }
        else {
            model.render(light, this.rgAnimAngles);
        }
        popMatrix();
    };
    return PolygonRenderInfo;
}());
var VClipRenderInfo = /** @class */ (function () {
    function VClipRenderInfo() {
    }
    VClipRenderInfo.prototype.render = function (obj, time) {
        // do nothing
    };
    VClipRenderInfo.prototype.renderFrame = function (obj, iBitmap) {
        var vclip = this.getVClip();
        var program;
        if (vclip.flags & VClipFlags.ROD) {
            program = programBillboardX;
        }
        else {
            program = programBillboard;
        }
        useProgram(program);
        var tex = _pig.loadBitmap(iBitmap, 1);
        if (!tex) {
            return;
        }
        bindTexture(1, tex.tex);
        var bmp = tex.bmp;
        gl.uniform3f(program.pos, obj.pos.x, obj.pos.y, obj.pos.z);
        gl.uniform2f(program.sizeTexture, bmp.width, bmp.height);
        gl.uniform1f(program.scale, obj.size / Math.max(bmp.width, bmp.height));
        loadAttribBuffer(program.aVertexPosition, program.bufferVertexPosition);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, program.bufferVertexPosition.numItems);
    };
    VClipRenderInfo.prototype.getVClip = function () {
        var vclip = this.vclip;
        if (!vclip) {
            this.vclip = vclip = _ham.rgVClips[this.vclip_num];
        }
        return vclip;
    };
    return VClipRenderInfo;
}());
var OneShotVClipRenderInfo = /** @class */ (function (_super) {
    __extends(OneShotVClipRenderInfo, _super);
    function OneShotVClipRenderInfo(vclip_num) {
        var _this = _super.call(this) || this;
        _this.vclip_num = vclip_num;
        return _this;
    }
    OneShotVClipRenderInfo.prototype.render = function (obj, time) {
        var vclip = this.getVClip();
        // odd objects go backwards?
        var iFrame = Math.floor(vclip.num_frames * (time - obj.creationTime) / (vclip.play_time));
        if (iFrame >= vclip.num_frames) {
            iFrame = vclip.num_frames - 1;
        }
        var iBitmap = vclip.frames[iFrame];
        this.renderFrame(obj, iBitmap);
    };
    return OneShotVClipRenderInfo;
}(VClipRenderInfo));
var LoopingVClipRenderInfo = /** @class */ (function (_super) {
    __extends(LoopingVClipRenderInfo, _super);
    function LoopingVClipRenderInfo() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LoopingVClipRenderInfo.prototype.load = function (view) {
        this.vclip_num = view.getUint32();
        this.frametime = view.getFixed();
        this.framenum = view.getUint8();
        return this;
    };
    LoopingVClipRenderInfo.prototype.render = function (obj, time) {
        var vclip = this.getVClip();
        var num = Number(obj._unique);
        // odd objects go backwards?
        var iFrame = Math.floor((time / this.frametime) + this.framenum + num) % vclip.num_frames;
        var iBitmap = (num & 1) ? vclip.frames[iFrame] : vclip.frames[vclip.num_frames - 1 - iFrame];
        this.renderFrame(obj, iBitmap);
    };
    return LoopingVClipRenderInfo;
}(VClipRenderInfo));
var MAX_AI_FLAGS = 11; // This MUST cause word (4 bytes) alignment in ai_static, allowing for one byte mode
var TURNROLL_SCALE = fix(0x4ec4 / 2);
var ROLL_RATE = fix(0x2000);
var HEADLIGHT_SCALE = 10;
var Item = /** @class */ (function () {
    function Item(type, id) {
        this.type = type;
        this.id = id;
        this._unique = (__unique++).toString();
        // console.log("type: " + type);
        if (type < 0 || type > 15) {
            throw new Error("unknown ObjectType: " + type);
        }
        this.mapCollisionHandlers = Item.mapCollisionHandlers[type];
        switch (type) {
            case ItemTypes.ROBOT:
                this.info = _ham.rgRobotTypes[id];
                break;
            case ItemTypes.FIREBALL:
                this.info = _ham.rgVClips[id];
                break;
            case ItemTypes.POWERUP:
                this.info = _ham.rgPowerupInfos[id];
                break;
            case ItemTypes.WEAPON:
                this.info = _ham.rgWeaponInfos[id];
                break;
            default:
                return;
        }
        // if (!this.info)
        // 	throw new Error ("object info not found");
    }
    Item.load = function (view) {
        var type = view.getUint8();
        var id = view.getInt8();
        switch (type) {
            case ItemTypes.PLAYER: // 4,		// the player on the console
            case ItemTypes.POWERUP: // 7,		// a powerup you can pick up
            case ItemTypes.ROBOT: // 2,		// an evil enemy
            case ItemTypes.COOP: // 14,	// a cooperative player CObject.
            case ItemTypes.CNTRLCEN: // 9,		// the control center
            case ItemTypes.HOSTAGE: // 3,		// a hostage you need to rescue
            case ItemTypes.WEAPON: // 5,		// a laser, missile, etc
                return new Item(type, id).load(view);
            // case ObjectTypes.WALL			: // 0,		// A CWall... not really an CObject, but used for collisions
            // case ObjectTypes.FIREBALL		: // 1,		// a fireball, part of an explosion
            // case ObjectTypes.CAMERA		: // 6,		// a camera to slew around with
            // case ObjectTypes.DEBRIS		: // 8,		// a piece of robot
            // case ObjectTypes.FLARE		: // 10,	// a flare
            // case ObjectTypes.CLUTTER		: // 11,	// misc objects
            // case ObjectTypes.GHOST		: // 12,	// what the player turns into when dead
            // case ObjectTypes.LIGHT		: // 13,	// a light source, & not much else
            // case ObjectTypes.MARKER		: // 15,	// a map marker
            // case ObjectTypes.CAMBOT		: // 16,	// a camera
            // case ObjectTypes.MONSTERBALL	: // 17,	// a monsterball
            // case ObjectTypes.SMOKE		: // 18,	// static smoke
            // case ObjectTypes.EXPLOSION	: // 19,	// static explosion particleEmitters
            // case ObjectTypes.EFFECT		: // 20,	// lightnings
            default:
                throw new Error("unknown object type: " + type);
        }
    };
    Object.defineProperty(Item.prototype, "direction", {
        get: function () { return this.orient._[2]; },
        enumerable: true,
        configurable: true
    });
    Item.prototype.load = function (view) {
        this.controlType = view.getUint8();
        this.movementType = view.getUint8();
        this.renderType = view.getUint8();
        this.flags = view.getUint8();
        this.iCube = view.getUint16();
        this.attachedObj = -1;
        this.pos = view.getVector();
        this.orient = view.getMatrix();
        this.size = view.getFixed();
        this.shields = view.getFixed();
        this.lastPos = view.getVector();
        this.containsType = view.getUint8();
        this.containsId = view.getUint8();
        this.containsCount = view.getUint8();
        switch (this.movementType) {
            case MovementTypes.PHYSICS:
                this.mover = new PhysicsInfo().load(view);
                break;
            case MovementTypes.SPINNING:
                this.mover = new SpinnerInfo().load(view);
                break;
            case MovementTypes.NONE:
                break;
            default:
                throw new Error("unknown MovementType: " + this.movementType);
        }
        switch (this.controlType) {
            case ControlTypes.NONE: // 0,	  // doesn't move (or change movement)
            case ControlTypes.FLYING: // 4,	  // the player is flying
            case ControlTypes.SLEW: // 5,	  // slewing
            case ControlTypes.DEBRIS: // 12,	  // this is a piece of debris
            case ControlTypes.CNTRLCEN: // 16,	  // the control center/main reactor
                break;
            case ControlTypes.AI: // 1,	  // driven by AI
                this.control = {
                    behavior: view.getUint8(),
                    flags: view.getUint8Array(MAX_AI_FLAGS),
                    hide_segment: view.getUint16(),
                    hide_index: view.getUint16(),
                    path_length: view.getUint16(),
                    cur_path_index: view.getUint16(),
                };
                if (view.gameVersion <= 25) {
                    view.getUint16(); // follow_path_start_seg
                    view.getUint16(); // follow_path_end_seg
                }
                break;
            case ControlTypes.POWERUP: // 13,	  // animating powerup blob
                var count = 1;
                if (view.gameVersion >= 25) {
                    count = view.getUint32();
                }
                switch (this.id) {
                    case PowerupTypes.VULCAN_WEAPON:
                    case PowerupTypes.GAUSS_WEAPON:
                        count = VULCAN_WEAPON_AMMO_AMOUNT;
                        break;
                    // case PowerupTypes.OMEGA_WEAPON:
                    // 	count = 1;
                    // 	break;
                }
                this.control = { count: count };
                break;
            case ControlTypes.WEAPON:
                this.control = {
                    parent_type: view.getInt16(),
                    parent_num: view.getInt16(),
                    parent_signature: view.getUint32(),
                };
                break;
            // case ControlTypes.WEAPON:		// 9,	  // laser, etc.
            // case ControlTypes.EXPLOSION:	// 2,	  // explosion sequencer
            // case ControlTypes.FLYTHROUGH:	// 6,	  // the flythrough system
            // case ControlTypes.REPAIRCEN:	// 10,	  // under the control of the repair center
            // case ControlTypes.MORPH:		// 11,	  // this CObject is being morphed
            // case ControlTypes.LIGHT:		// 14,	  // doesn't actually do anything
            // case ControlTypes.REMOTE:		// 15,	  // controlled by another net player
            // case ControlTypes.WAYPOINT:	// 17,
            // case ControlTypes.CAMERA:		// 18,
            default:
                throw new Error("unknown ControlType: " + this.controlType);
        }
        switch (this.renderType) {
            default:
                throw new Error("unknown RenderType: " + this.renderType);
            case RenderTypes.NONE: // 0,	// does not render
            case RenderTypes.LASER: // 3,	// a laser
                break;
            case RenderTypes.POLYOBJ: // 1,	// a polygon model
            case RenderTypes.MORPH: // 6,	// a robot being morphed
                this.renderInfo = new PolygonRenderInfo().load(view);
                break;
            case RenderTypes.HOSTAGE: // 4,	// a hostage
            case RenderTypes.POWERUP: // 5,	// a powerup
            case RenderTypes.WEAPON_VCLIP: // 7,	// a weapon that renders as a tVideoClip
                // case RenderTypes.FIREBALL:		// 2,	// a fireball
                this.renderInfo = new LoopingVClipRenderInfo().load(view);
                break;
            // case RenderTypes.THRUSTER:	// 8,	// like afterburner, but doesn't cast light
            // case RenderTypes.EXPLBLAST:	// 9,	// white explosion light blast
            // case RenderTypes.SHRAPNELS:	// 10,	// smoke trails coming from explosions
            // case RenderTypes.SMOKE:		// 11,
            // case RenderTypes.LIGHTNING:	// 12,
            // case RenderTypes.SOUND:		// 13,
            // case RenderTypes.SHOCKWAVE:	// 14,	// concentric shockwave effect
        }
        return this;
    };
    Item.prototype.isValid = function () {
        if (this.type === ItemTypes.NONE) {
            return false;
        }
        if (this.flags & ItemFlags.SHOULD_BE_DEAD) {
            return false;
        }
        return true;
    };
    Item.prototype.link = function (cube) {
        var cubeOld = this.cube;
        if (cubeOld === cube) {
            return;
        }
        if (cubeOld) {
            assert(!this.isDead());
            var index = this.cubeIndex;
            var objectOther = cubeOld._rgObjects.pop();
            if (!objectOther) {
                throw new Error();
            }
            if (objectOther.cubeIndex !== cubeOld._rgObjects.length) {
                throw new Error("wrong cube");
            }
            if (this !== objectOther) {
                cubeOld._rgObjects[index] = objectOther;
                objectOther.cubeIndex = index;
            }
        }
        if (cube) {
            this.cube = cube;
            this.iCube = cube.index;
            this.cubeIndex = cube._rgObjects.length;
            cube._rgObjects.push(this);
        }
        else {
            this.iCube = -1;
            this.cubeIndex = -1;
        }
    };
    Item.prototype.getEmittedLight = function (time) {
        var intensity = 0;
        switch (this.type) {
            case ItemTypes.PLAYER:
                if (_player.flags & PlayerFlags.HEADLIGHT_ON) {
                    intensity = HEADLIGHT_SCALE;
                }
                else {
                    var pi = this.mover;
                    var k = pi.mass * pi.drag / (1 - pi.drag);
                    intensity = Math.max(pi.velocity.len() * k / 4, 2) + 0.5;
                }
                break;
            case ItemTypes.FIREBALL:
                if (this.id < 0) {
                    return null;
                }
                var vclip = this.info;
                intensity = vclip.light_value;
                var timeleft = this.deathTime - time;
                if (timeleft < 4) {
                    intensity *= timeleft / vclip.play_time;
                }
                break;
            case ItemTypes.ROBOT:
                var rt = this.info;
                intensity = rt.lightcast;
                break;
            case ItemTypes.WEAPON:
                var wi = this.info;
                intensity = wi.light;
                // if (this.id === WeaponTypes.FLARE)// TODO: flicker flares
                break;
            case ItemTypes.POWERUP:
                var powerupInfo = this.info;
                intensity = powerupInfo.light;
                break;
            case ItemTypes.MARKER:
            case ItemTypes.DEBRIS:
            case ItemTypes.LIGHT:
                break;
            // default:
            // 	throw new Error("unhandled type: " + this.type);
        }
        if (intensity <= 0) {
            return null;
        }
        if (intensity > 1) {
            intensity = 1;
        }
        return Vec3.One.scale(intensity);
    };
    Item.prototype.update = function (time, frameTime) {
        if (this.flags & ItemFlags.SHOULD_BE_DEAD) {
            return false;
        }
        switch (this.controlType) {
            case ControlTypes.FLYING:
                var ship = _ham.ship;
                var pi = this.mover;
                if (this.controls) {
                    pi.thrust = this.orient.multiply(this.controls.thrust).scale(ship.max_thrust / frameTime);
                    pi.rotthrust = this.controls.rot.scale(ship.max_rotthrust / frameTime);
                }
                if (pi.flags & PhysicsFlags.WIGGLE) {
                    var wiggle = Math.sin(time * Math.PI * 2) * ship.wiggle;
                    pi.velocity = pi.velocity.addScale(this.orient._[1], wiggle);
                }
                break;
            case ControlTypes.POWERUP:
                break;
            case ControlTypes.AI:
                this.doAI(time, frameTime);
                break;
            case ControlTypes.EXPLOSION:
                this.doExplosion(time, frameTime);
                break;
        }
        if (time >= this.deathTime || (this.flags & ItemFlags.SHOULD_BE_DEAD)) {
            switch (this.controlType) {
                case ControlTypes.POWERUP:
                    // create explosion
                    break;
            }
            return false;
        }
        if (this.mover) {
            return this.mover.move(this, time, frameTime);
        }
        return true;
    };
    Item.prototype.doAI = function (time, frameTime) {
        // do nothing
    };
    Item.prototype.render = function (time) {
        if (this.type === ItemTypes.PLAYER) {
            return;
        }
        if (this.renderInfo) {
            this.renderInfo.render(this, time);
        }
    };
    Item.prototype.fireLaser = function (iWeapon, laser_level, cFires, fQuad) {
        switch (iWeapon) {
            case PrimaryWeaponIndex.LASER:
                // Laser_offset?
                var weaponNum = void 0;
                if (laser_level <= MAX_LASER_LEVEL) {
                    weaponNum = WeaponTypes.LASER + laser_level;
                }
                else {
                    weaponNum = WeaponTypes.SUPER_LASER + laser_level - (MAX_LASER_LEVEL + 1);
                }
                this.fireWeapon(weaponNum, 0, 0, 0, 0, true);
                this.fireWeapon(weaponNum, 1);
                if (fQuad) {
                    this.fireWeapon(weaponNum, 2);
                    this.fireWeapon(weaponNum, 3);
                }
                break;
        }
    };
    Item.prototype.fireWeapon = function (laser_type, gun_num, spreadr, spreadu, delay, make_sound, harmless) {
        if (make_sound === void 0) { make_sound = false; }
        if (harmless === void 0) { harmless = false; }
        var wi = _ham.rgWeaponInfos[laser_type];
        var ship = _ham.ship;
        var pos = this.orient.transpose().rotate(ship.gun_points[gun_num]).add(this.pos);
        var dir = this.direction;
        // if (delay)
        // 	pos = pos.sub(dir.scale(delay * wi.speed[_difficultyLevel]));
        if (spreadr) {
            dir = dir.addScale(this.orient._[0], spreadr);
        }
        if (spreadu) {
            dir = dir.addScale(this.orient._[0], spreadu);
        }
        var obj = wi.createObject(this, pos, this.cube, dir);
        obj.multiplier = 1;
        if (this.type === ItemTypes.PLAYER) {
            if (laser_type >= WeaponTypes.LASER && laser_type <= MAX_SUPER_LASER_LEVEL) {
                obj.multiplier = 3 / 4;
            }
        }
        _level.rgObjects.push(obj);
        if (make_sound && wi.flash_sound >= 0) {
            if (this.type === ItemTypes.PLAYER) {
                this.playSound(wi.flash_sound);
            }
            else {
                _ham.playSound(wi.flash_sound, pos);
            }
        }
    };
    Item.prototype.createFireball = function (time, delay) {
        var obj = this.cube.createExplosion(time, this.pos, 0, -1, delay);
        obj.control = {
            delete_obj: this,
            spawn: true,
        };
        return obj;
    };
    Item.prototype.doExplosion = function (time, frameTime) {
        var control = this.control;
        if (control) {
            if (time >= this.deathTime) {
                var del_obj = control.delete_obj;
                if (control.spawn) {
                    var vclip = del_obj.getExplosionVClip(1);
                    var expl_obj = del_obj.cube.createExplosion(time, del_obj.pos, del_obj.size * (5 / 2), vclip);
                    if (expl_obj && !(expl_obj.flags & ItemFlags.SHOULD_BE_DEAD)) {
                        expl_obj.control = {
                            delete_time: (time + control.death_time) / 2,
                            delete_obj: del_obj,
                        };
                    }
                    else {
                        del_obj.flags |= ItemFlags.SHOULD_BE_DEAD;
                    }
                    // TODO: drop stuff
                    var rt = del_obj.info;
                    if (rt.exp2_sound_num >= 0) {
                        _ham.playSound(rt.exp2_sound_num, del_obj.pos);
                    }
                    // TODO: debris
                }
                if (control.delete_obj) {
                    del_obj.flags |= ItemFlags.SHOULD_BE_DEAD;
                }
            }
        }
    };
    Item.prototype.getExplosionVClip = function (stage) {
        switch (this.type) {
            case ItemTypes.PLAYER:
                var rt = this.info;
                if (stage === 0 && rt.exp1_vclip_num >= 0) {
                    return rt.exp1_vclip_num;
                }
                if (stage === 1 && rt.exp2_vclip_num >= 0) {
                    return rt.exp2_vclip_num;
                }
                break;
            case ItemTypes.ROBOT:
                if (_ham.ship.expl_vclip_num >= 0) {
                    return _ham.ship.expl_vclip_num;
                }
                break;
        }
        return KnownVClips.SMALL_EXPLOSION;
    };
    Item.prototype.playSound = function (iSound) {
        _ham.playObjectSound(iSound, this);
    };
    /*
    collide(other: item)
    {
        const mapCollisionHandlers = this.mapCollisionHandlers;
        if (!mapCollisionHandlers)
            return;

        const otherType = other.type;
        const collisionHandler = mapCollisionHandlers[<any>otherType];
        if (!collisionHandler)
            return;

        return collisionHandler(other);
    }
    */
    Item.prototype.collidePlayerHostage = function (time, pos, other) {
        // TODO: flags
        // TODO: increment hostage count
        _ham.playSound(SoundFile_Sounds.HOSTAGE_RESCUED);
        return other;
    };
    Item.prototype.collidePlayerMarker = function (time, pos, other) { return null; };
    Item.prototype.collidePlayerClutter = function (time, pos, other) { return null; };
    Item.prototype.collidePlayerControlCenter = function (time, pos, other) { return null; };
    Item.prototype.collidePlayerPlayer = function (time, pos, other) { return null; };
    Item.prototype.collidePlayerPowerup = function (time, pos, other) {
        if (!_player.pickUpPowerup(other.id)) {
            return null;
        }
        var pi = other.info;
        if (pi && pi.hit_sound) {
            _ham.playSound(pi.hit_sound);
        }
        return other;
    };
    Item.prototype.collidePlayerWeapon = function (time, pos, other) { return null; };
    Item.prototype.collidePlayerRobot = function (time, pos, other) {
        var pi = this.mover;
        var piOther = other.mover;
        var vel = pi.velocity;
        var velOther = piOther.velocity;
        var mass = pi.mass;
        var massOther = piOther.mass;
        var force = vel.addScale(velOther, -2 * mass * massOther / (mass + massOther));
        piOther.velocity = velOther.addScale(force, 1 / piOther.mass);
        pi.velocity = vel.addScale(force, -1 / pi.mass);
        return null;
    };
    Item.prototype.collideRobotControlCenter = function (time, pos, other) { return null; };
    Item.prototype.collideRobotRobot = function (time, pos, other) { return null; };
    Item.prototype.collideRobotWeapon = function (time, pos, weapon) {
        var rt = this.info;
        if (rt.exp1_vclip_num >= 0) {
            weapon.cube.createExplosion(time, pos, this.size * 3 / 8, rt.exp1_vclip_num);
        }
        if (rt.exp1_sound_num >= 0) {
            _ham.playSound(rt.exp1_sound_num, pos);
        }
        if (!(weapon.flags & ItemFlags.HARMLESS)) {
            var damage = weapon.shields * weapon.multiplier;
            this.damage(time, damage);
        }
        return weapon;
    };
    Item.prototype.damage = function (time, damage) {
        if (this.flags & ItemFlags.EXPLODING || this.shields < 0) {
            return false;
        }
        this.shields -= damage;
        if (this.shields < 0) {
            if (this.type === ItemTypes.PLAYER) {
                // do nothing
            }
            else {
                var rt = this.info;
                var delay = (rt.kamikaze) ? .01 : .25;
                this.createFireball(time, delay);
            }
        }
        return false;
    };
    Item.prototype.collideWeaponClutter = function (time, pos, other) { return null; };
    Item.prototype.collideWeaponControlCenter = function (time, pos, other) { return null; };
    Item.prototype.collideWeaponDebris = function (time, pos, other) { return null; };
    Item.prototype.collideWeaponWeapon = function (time, pos, other) { return null; };
    Item.prototype.isDead = function () {
        return this.cubeIndex < 0;
    };
    Item.mapCollisionHandlers = [];
    return Item;
}());
(function () {
    Item.mapCollisionHandlers[ItemTypes.HOSTAGE] = [];
    Item.mapCollisionHandlers[ItemTypes.MARKER] = [];
    Item.mapCollisionHandlers[ItemTypes.PLAYER] = [];
    Item.mapCollisionHandlers[ItemTypes.ROBOT] = [];
    Item.mapCollisionHandlers[ItemTypes.WEAPON] = [];
    Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.HOSTAGE] = Item.prototype.collidePlayerHostage;
    Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.MARKER] = Item.prototype.collidePlayerMarker;
    Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.CLUTTER] = Item.prototype.collidePlayerClutter;
    Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.CNTRLCEN] = Item.prototype.collidePlayerControlCenter;
    Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.PLAYER] = Item.prototype.collidePlayerPlayer;
    Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.POWERUP] = Item.prototype.collidePlayerPowerup;
    Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.WEAPON] = Item.prototype.collidePlayerWeapon;
    Item.mapCollisionHandlers[ItemTypes.PLAYER][ItemTypes.ROBOT] = Item.prototype.collidePlayerRobot;
    Item.mapCollisionHandlers[ItemTypes.ROBOT][ItemTypes.CNTRLCEN] = Item.prototype.collideRobotControlCenter;
    Item.mapCollisionHandlers[ItemTypes.ROBOT][ItemTypes.ROBOT] = Item.prototype.collideRobotRobot;
    Item.mapCollisionHandlers[ItemTypes.ROBOT][ItemTypes.WEAPON] = Item.prototype.collideRobotWeapon;
    Item.mapCollisionHandlers[ItemTypes.WEAPON][ItemTypes.CLUTTER] = Item.prototype.collideWeaponClutter;
    Item.mapCollisionHandlers[ItemTypes.WEAPON][ItemTypes.CNTRLCEN] = Item.prototype.collideWeaponControlCenter;
    Item.mapCollisionHandlers[ItemTypes.WEAPON][ItemTypes.DEBRIS] = Item.prototype.collideWeaponDebris;
    Item.mapCollisionHandlers[ItemTypes.WEAPON][ItemTypes.WEAPON] = Item.prototype.collideWeaponWeapon;
    for (var i in Item.mapCollisionHandlers) {
        if (!Item.mapCollisionHandlers.hasOwnProperty(i)) {
            continue;
        }
        var mapCollisionHandlers = Item.mapCollisionHandlers[i];
        for (var j in mapCollisionHandlers) {
            if (!mapCollisionHandlers.hasOwnProperty(j)) {
                continue;
            }
            var mapReversed = Item.mapCollisionHandlers[j];
            if (!mapReversed) {
                mapReversed = Item.mapCollisionHandlers[j] = [];
            }
            if (!mapReversed[i]) {
                mapReversed[i] = (function (fn) {
                    return function (time, pos, other) {
                        return fn.call(other, time, pos, this);
                    };
                })(Item.mapCollisionHandlers[i][j]);
            }
        }
    }
})();
var _hog;
var HogEntry = /** @class */ (function () {
    function HogEntry(name, view) {
        this.name = name;
        this.view = view;
    }
    return HogEntry;
}());
var Hog = /** @class */ (function () {
    function Hog() {
    }
    Hog.prototype.load = function (view) {
        var stream = new DataStream(view);
        var magic = stream.getString(3);
        if (magic !== "DHF") {
            throw new Error("invalid HOG file signature");
        }
        var mapEntries = {};
        while (stream.position < stream.byteLength) {
            var strFilename = stream.getTerminatedString(["\0", "\n"], 13);
            var cbFile = stream.getInt32();
            var ibFile = stream.position;
            mapEntries[strFilename.toLowerCase()] = new HogEntry(strFilename, stream.view.slice(ibFile, cbFile));
            stream.position = ibFile + cbFile;
        }
        this._mapEntries = mapEntries;
        return this;
    };
    Hog.prototype.getEntry = function (name) {
        return this._mapEntries[name.toLowerCase()];
    };
    return Hog;
}());
/// <reference path="DataView.ts" />
/// <reference path="DataStream.ts" />
/// <reference path="webgl.ts" />
/// <reference path="Math.ts" />
/// <reference path="Item.ts" />
/// <reference path="Player.ts" />
/// <reference path="Ham.ts" />
/// <reference path="Pig.ts" />
/// <reference path="Hog.ts" />
/// <reference path="Level.ts" />
var _animationFunction;
var _focus = true;
var _pageX = null;
var _pageY = null;
var _timeLast = null;
var _iTriView = 0;
var _iTriViewLast = 0;
var _iStep = 0;
var _iStepLast = NaN;
var _stats;
if (!window.AudioContext) {
    window.AudioContext = window.webkitAudioContext;
}
$(document).ready(function () {
    if (AudioContext !== undefined) {
        _audio = new AudioContext();
        // no more doppler :(
        // const listener = _audio.listener;
        // listener.dopplerFactor = .15;
        var compressor = _audio.createDynamicsCompressor();
        compressor.connect(_audio.destination);
        _mainAudio = compressor;
    }
    function loadBuffer(name, pname) {
        var progr = $("#" + pname + " div");
        return $.ajax({
            url: name,
            type: "GET",
            xhrFields: {
                responseType: "arraybuffer",
            },
            dataType: "binary",
        }).progress(function (pct) {
            progr.css({ width: pct + "%" });
        }).done(function (view) {
            progr.css({ width: "100%", background: "green" });
        });
    }
    $.ajaxPrefilter(function (options, originalOptions, jqXHR) {
        options.xhrFields = $.extend(options.xhrFields, {}, {
            onprogress: function (e) {
                if (e.lengthComputable) {
                    var deferred = jqXHR.deferred;
                    if (deferred) {
                        deferred.notify(Math.floor(e.loaded * 100 / e.total));
                    }
                }
            },
        });
    });
    $.when(loadBuffer("assets/data/D2DEMO.PIG", "prog1"), loadBuffer("assets/data/D2DEMO.HOG", "prog2"), loadBuffer("assets/data/D2DEMO.HAM", "prog3")).then(function (pigData, hogData, hamData) {
        _ham = new Ham().load(hamData[0]);
        _pig = new Pig().load(pigData[0]);
        _hog = new Hog().load(hogData[0]);
    }).then(webGLStart).then(function () {
        if (window.location.host.indexOf("localhost") >= 0) {
            onDataLoaded();
        }
        else {
            _ham.playSound(114);
            $("#start")
                .attr("disabled", null)
                .text("Launch")
                .click(onDataLoaded);
        }
    });
});
function animate(time) {
    if (!_animationFunction || !_focus) {
        return;
    }
    requestAnimationFrame(animate);
    if (time) {
        if (_stats) {
            _stats.begin();
        }
        _animationFunction(time / 1000);
        if (_stats) {
            _stats.end();
        }
    }
}
var Palette = /** @class */ (function () {
    function Palette() {
    }
    Palette.prototype.load = function (view) {
        var stream = new DataStream(view);
        this.colors = stream.getRGBArray(256);
        return this;
    };
    return Palette;
}());
var _level;
var _cubeDebug;
var _rgCubesDebug;
var _rgVisibleCubesDebug;
var _rgVisibleSidesDebug;
var _rgVisibleSidesBlendedDebug;
var _stackDebug;
var _stepsDebug;
function createProxy(obj, rgMaps) {
    var unique = 1;
    var mapConverted = {};
    var result = convert(obj);
    // clean up
    for (var i in mapConverted) {
        if (!mapConverted.hasOwnProperty(i)) {
            continue;
        }
        var res = mapConverted[i];
        var src = res.__src;
        delete src.___;
        delete res.__src;
    }
    return result;
    function convert(obj) {
        if (typeof (obj) !== "object") {
            return obj;
        }
        var result = mapConverted[obj.___];
        if (result) {
            return result;
        }
        if (!obj.___) {
            obj.___ = unique++;
        }
        var cons = obj.constructor;
        if (cons === Array) {
            result = [];
            mapConverted[obj.___] = result;
            for (var i = obj.length; i--;) {
                result[i] = convert(obj[i]);
            }
        }
        else {
            for (var i = rgMaps.length; i--;) {
                var map = rgMaps[i];
                if (cons === map[0]) {
                    var rgFields = map[1];
                    result = {};
                    mapConverted[obj.___] = result;
                    for (var iField = rgFields.length; iField--;) {
                        var fieldName = rgFields[iField];
                        result[fieldName] = convert(obj[fieldName]);
                    }
                    break;
                }
            }
            if (!result) {
                throw new Error("unmarshallable constructor: " + obj);
            }
        }
        result.__src = obj;
        return result;
    }
}
function onDataLoaded() {
    $("#canvas").show();
    $("#loader").hide();
    updateViewport();
    window.oncontextmenu = function () { return false; };
    /*
    private _stats = new Stats();
    private _stats.setMode(0); // 0: fps, 1: ms
    private _stats.domElement.style.position = 'absolute';
    private _stats.domElement.style.left = '0px';
    private _stats.domElement.style.top = '0px';
    document.body.appendChild(_stats.domElement);
    */
    $(window).focus(function () {
        if (_focus === true) {
            return;
        }
        _focus = true;
        _pageX = _pageY = _timeLast = null;
        Keys.reset();
        // console.log("START animation");
        if (_animationFunction) {
            animate();
        }
    }).blur(function () {
        if (_focus === false) {
            return;
        }
        _focus = false;
        // console.log("STOP animation");
    }).resize(function () {
        // console.log(canvas.clientWidth, canvas.clientHeight);
        updateViewport();
    });
    $(document).on("fullscreenchange", function () {
        document.body.requestPointerLock();
    }).mousedown(function (event) {
        // return;
        if (typeof document.body.requestPointerLock !== "undefined") {
            document.body.requestPointerLock();
        }
        Keys.keyDown(-event.which);
        return false;
    }).mouseup(function (event) {
        Keys.keyUp(-event.which);
        event.preventDefault();
        return false;
    }).mouseenter(function () {
        // console.log("MOUSEENTER");
        _pageX = _pageY = null;
    }).keydown(function (event) {
        if (Keys.keyDown(event.keyCode)) {
            event.preventDefault();
        }
        switch (event.keyCode) {
            case 13:
                if (event.altKey) {
                    document.body.requestFullscreen();
                }
                break;
        }
    }).keyup(function (event) {
        Keys.keyUp(event.keyCode);
    });
    $(document.body).on("mousemove", function (event) {
        var evt = event.originalEvent;
        if (typeof (evt.movementX) !== "undefined") {
            Keys._mouseDeltaX += evt.movementX;
            Keys._mouseDeltaY += evt.movementY;
        }
        else if (typeof (evt.webkitMovementX) !== "undefined") {
            Keys._mouseDeltaX += evt.webkitMovementX;
            Keys._mouseDeltaY += evt.webkitMovementY;
        }
        if (typeof _pageX === "number" && !isNaN(_pageX)) {
            Keys._mouseDeltaX += event.pageX - _pageX;
        }
        if (typeof _pageY === "number" && !isNaN(_pageY)) {
            Keys._mouseDeltaY += event.pageY - _pageY;
        }
        _pageX = event.pageX;
        _pageY = event.pageY;
    });
    var entryLevel1 = _hog.getEntry("d2leva-1.sl2");
    if (entryLevel1) {
        var level_1 = _level = new Level(entryLevel1.view);
        var visibilityWorker_1 = new Worker("./Visibility_worker.js");
        visibilityWorker_1.onmessage = function (event) {
            var data = event.data;
            if (data) {
                for (var key in data) {
                    if (!data.hasOwnProperty(key)) {
                        continue;
                    }
                    var value = data[key];
                    switch (key) {
                        case "setVisibility":
                            var cube = level_1.cubes[value.iCube];
                            cube.rgVisibleNeighbors = value.rgVisibleNeighbors.map(function (i) { return level_1.cubes[i]; });
                            cube.rgLightingNeighbors = value.rgLightingNeighbors.map(function (i) { return level_1.cubes[i]; });
                            cube.rgVisibleSides = value.rgVisibleSides.map(function (i) { return level_1.getSideByIndex(i); });
                            cube.rgVisibleSidesBlended = value.rgVisibleSidesBlended.map(function (i) { return level_1.getSideByIndex(i); });
                            cube.rgLightingSides = cube.rgVisibleSides.concat(cube.rgVisibleSidesBlended);
                            break;
                    }
                }
            }
        };
        var levelProxy = createProxy(level_1, [
            [Level, ["cubes"]],
            [Cube, ["rgSides", "index", "center", "_unique"]],
            [Side, ["vertices", "rgTriangles", "neighbor", "_unique", "tex1", "tex2"]],
            [Triangle, ["anchor", "normal"]],
            [Vec3, ["x", "y", "z"]],
        ]);
        visibilityWorker_1.postMessage({
            load: {
                level: levelProxy,
                LIGHT_DISTANCE_THRESHOLD: LIGHT_DISTANCE_THRESHOLD,
            },
        });
        /*
        if (false)
        {
            if (console.profile)
                console.profile();
            const startTime = new Date().getTime();

            // for (let iCube = 0; iCube < Math.min (100, level.cubes.length); ++iCube)
            for (let iCube = level.cubes.length; iCube--;)
            {
                const cube = level.cubes[iCube];
                if (cube.index >= 0)
                    cube.getVisibleNeighbors();
            }

            if (console.profileEnd)
                console.profileEnd();
            console.log((new Date().getTime() - startTime) / 1000);
        }
        */
        var entryPalette = _hog.getEntry(level_1.paletteName);
        if (!entryPalette) {
            throw new Error("palette " + level_1.paletteName + " not found");
        }
        var palette = new Palette().load(entryPalette.view);
        var palTex_1 = initPalette(palette.colors);
        var bufferVertexPosition = gl.createBuffer();
        var bufferVertexTextureCoord = gl.createBuffer();
        var bufferVertexLight = gl.createBuffer();
        for (var iCube = level_1.cubes.length; iCube--;) {
            var cube = level_1.cubes[iCube];
            for (var iSide = 6; iSide--;) {
                var side = cube.rgSides[iSide];
                side.static_light = side.getTextureLighting();
            }
        }
        /* vertex positions
        {
            const unpacked = [];
            level.rgVertices.forEach((e) => { e.pushTo(unpacked); });

            const texVertexPositions = createTexture();

            gl.bindTexture(gl.TEXTURE_2D, texVertexPositions);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, level.rgVertices.length, 1, 0, gl.RGB, gl.FLOAT, new Float32Array(unpacked));

            bindTexture(3, texVertexPositions);
            gl.uniform1i(programDouble.sampVertexPositions, 3);
        }
        */
        var timeStart = new Date().getTime() / 1000;
        var _iTriViewLast_1 = -1;
        var rgCubes_1 = level_1.cubes;
        var rgSides_1 = Array.prototype.concat.apply([], level_1.cubes.map(function (c) { return c.rgSides.filter(function (s) { return !s.neighbor; }); }));
        var rgSidesBlended_1 = Array.prototype.concat.apply([], level_1.cubes.map(function (c) { return c.rgSides.filter(function (s) { return !!s.neighbor; }); }));
        var viewer_1 = level_1.rgObjects[0];
        viewer_1.controlType = ControlTypes.FLYING;
        viewer_1.movementType = MovementTypes.PHYSICS;
        viewer_1.controls = Keys;
        var flash = viewer_1.cube.createExplosion(0, viewer_1.pos.addScale(viewer_1.orient._[2], viewer_1.size * 0.8), viewer_1.size, KnownVClips.PLAYER_APPEARANCE);
        flash.orient = viewer_1.orient;
        _ham.playSound(_ham.rgVClips[KnownVClips.PLAYER_APPEARANCE].sound_num);
        var iWeapon_1 = 0;
        var timeFire_1 = 0;
        var cubeLast_1;
        var drawAnimationFrame = function (time) {
            function fetchVisibility(cube) {
                if (cube && !cube.rgVisibleNeighbors) {
                    cube.rgVisibleNeighbors = [];
                    visibilityWorker_1.postMessage({ getVisibility: cube.index });
                }
            }
            function renderPath(rgNodes) {
                if (!rgNodes || rgNodes.length < 2) {
                    return;
                }
                var rgVertices = [];
                var rgColors = [];
                for (var _i = 0, rgNodes_1 = rgNodes; _i < rgNodes_1.length; _i++) {
                    var node = rgNodes_1[_i];
                    node.pos.pushTo(rgVertices);
                    Vec3.One.pushTo(rgColors);
                }
                var bufferVertices = createBuffer(rgVertices, 3);
                var bufferColors = createBuffer(rgColors, 3);
                useProgram(programFlat);
                gl.uniform3f(programFlat.light, 1, 1, 1);
                loadAttribBuffer(programFlat.aVertexPosition, bufferVertices);
                loadAttribBuffer(programFlat.aVertexColor, bufferColors);
                gl.drawArrays(gl.LINE_STRIP, 0, rgNodes.length);
                gl.deleteBuffer(bufferVertices);
                gl.deleteBuffer(bufferColors);
            }
            var timeLast = _timeLast;
            _timeLast = time;
            if (!timeLast) {
                return;
            }
            var frameTime = (time - timeLast);
            if (!frameTime) {
                return;
            }
            Keys.updateControls(frameTime);
            // do effects
            _ham.updateEffects(frameTime);
            ExplodingWall.update(time);
            CloakingWall.update(frameTime);
            level_1.update(time, frameTime);
            if (Keys.firePrimary) {
                if (time > timeFire_1) {
                    var weapon = _ham.rgWeaponInfos[_player.primary_weapon];
                    timeFire_1 = time + weapon.fire_wait;
                    viewer_1.fireLaser(iWeapon_1, _player.laser_level, 0, !!(_player.flags & PlayerFlags.QUAD_LASERS));
                }
            }
            var pos = viewer_1.pos;
            var orient = viewer_1.orient;
            beginScene(pos, orient);
            if (_audio) {
                PlayingSound.update();
                var listener = _audio.listener;
                var vel = viewer_1.mover.velocity;
                var lookAt = matModelView.getRow(2);
                var lookUp = matModelView.getRow(1);
                listener.setOrientation(-lookAt[0], -lookAt[1], -lookAt[2], lookUp[0], lookUp[1], -lookUp[2]);
                listener.setPosition(pos.x + lookUp[0] / 100, pos.y + lookUp[1] / 100, pos.z - lookUp[2] / 100);
                // no more doppler :(
                // listener.setVelocity(vel.x, vel.y, vel.z);
            }
            bindTexture(0, palTex_1);
            gl.enable(gl.DEPTH_TEST);
            // gl.enable(gl.BLEND);
            gl.disable(gl.BLEND);
            gl.disable(gl.DEPTH_TEST);
            var cubeInside = viewer_1.cube;
            if (cubeInside) {
                if (!cubeInside.isPointInside(pos)) {
                    // console.log("OUTSIDE");
                    cubeInside = null;
                }
            }
            if (!cubeInside) {
                for (var iCube = rgCubes_1.length; iCube--;) {
                    var cube = rgCubes_1[iCube];
                    if (cube.isPointInside(pos)) {
                        cubeInside = cube;
                        break;
                    }
                }
            }
            var rgVisibleCubes;
            var rgVisibleSides;
            var rgVisibleSidesBlended;
            if (cubeInside) {
                if (cubeLast_1 !== cubeInside) {
                    cubeLast_1 = cubeInside;
                    fetchVisibility(cubeInside);
                    for (var iSide = 6; iSide--;) {
                        var side = cubeInside.rgSides[iSide];
                        if (side) {
                            fetchVisibility(side.neighbor);
                        }
                    }
                }
                rgVisibleCubes = cubeInside.rgVisibleNeighbors || [];
                rgVisibleSides = cubeInside.rgVisibleSides || [];
                rgVisibleSidesBlended = cubeInside.rgVisibleSidesBlended || [];
            }
            else {
                rgVisibleCubes = rgCubes_1;
                rgVisibleSides = rgSides_1;
                rgVisibleSidesBlended = rgSidesBlended_1;
            }
            /*DEBUG
            if (Keys.lockDebug)
            {
                if (_cubeDebug)
                {
                    _cubeDebug = null;
                    _rgCubesDebug = null;
                }
                else
                {
                    _iStep = _iTriView = 0;
                    _iStepLast = _iTriViewLast = null;
                    _rgCubesDebug = rgCubes;
                    _cubeDebug = cubeInside;

                    _stackDebug = [];
                    _stepsDebug = _cubeDebug.rgDebug;

                    _rgVisibleCubesDebug = rgVisibleCubes;
                    _rgVisibleSidesDebug = rgVisibleSides;
                    _rgVisibleSidesBlendedDebug = rgVisibleSidesBlended;
                }
            }

            if (_cubeDebug)
            {
                rgVisibleCubes = _rgVisibleCubesDebug;
                rgVisibleSides = _rgVisibleSidesDebug;
                rgVisibleSidesBlended = _rgVisibleSidesBlendedDebug;

                if (_iStep < 0)
                    _iStep = 0;
                else if (_iStep >= _stepsDebug.length)
                    _iStep = _stepsDebug.length - 1;

                if (Keys.stepDown && _stackDebug.length > 0)
                {
                    _stepsDebug = _stackDebug.pop();
                    _iStep = _stepsDebug._iStep;
                    // delete _stepsDebug._iStep;
                    _iStepLast = undefined;
                }
                else if (Keys.stepUp)
                {
                    const stepDebug = _stepsDebug[_iStep];
                    if (stepDebug.children && stepDebug.children.length)
                    {
                        _stepsDebug._iStep = _iStep;
                        _stackDebug.push(_stepsDebug);

                        _stepsDebug = stepDebug.children;
                        _iStep = _stepsDebug._iStep || 0;
                        _iStepLast = undefined;
                    }
                }

                if (_iStepLast !== _iStep)
                {
                    _iStepLast = _iStep;

                    const step = _stepsDebug[_iStep];
                    if (step)
                    {
                        console.log(_stackDebug.length, _cubeDebug.index, step.reject, step);
                    }
                }
            }
            */
            function updateLighting() {
                var lightingDistance2 = LIGHT_DISTANCE_THRESHOLD * LIGHT_DISTANCE_THRESHOLD;
                var center = cubeLast_1.center;
                var rgLightingSides = cubeLast_1.rgLightingSides;
                if (rgLightingSides) {
                    var mapObjectLights = {};
                    for (var i = rgLightingSides.length; i--;) {
                        var side = rgLightingSides[i];
                        var rgVertices = side.vertices;
                        var rgVertexLight = side.rgVertexLight;
                        rgVertexLight[0] = null;
                        rgVertexLight[1] = null;
                        rgVertexLight[2] = null;
                        rgVertexLight[3] = null;
                        side.updateLight = true;
                        var rgLightingCubes = side.rgLightingCubes;
                        for (var iCube = rgLightingCubes.length; iCube--;) {
                            var cube = rgLightingCubes[iCube];
                            var rgObjects = cube._rgObjects;
                            for (var iObject = rgObjects.length; iObject--;) {
                                var object = rgObjects[iObject];
                                assert(!object.isDead());
                                var objectLight = mapObjectLights[object._unique];
                                if (!objectLight) {
                                    objectLight = mapObjectLights[object._unique] = object.getEmittedLight(time);
                                }
                                if (objectLight) {
                                    var pos_1 = object.pos;
                                    for (var iVertex = 4; iVertex--;) {
                                        var vertex = rgVertices[iVertex];
                                        var dist2 = vertex.distanceTo2(pos_1);
                                        if (dist2 <= lightingDistance2) {
                                            var dist = dist2 < 16 ? 16 : Math.sqrt(dist2);
                                            var light = rgVertexLight[iVertex];
                                            if (light) {
                                                light = light.addScale(objectLight, 1 / dist);
                                            }
                                            else {
                                                light = objectLight.scale(1 / dist);
                                            }
                                            rgVertexLight[iVertex] = light;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            function Math_sqrt(x) { return Math.sqrt(x); }
            // updateLighting();
            var fWireframe = Keys.wireframe;
            if (true) {
                gl.disable(gl.CULL_FACE);
                gl.enable(gl.DEPTH_TEST);
                // gl.enable(gl.DEPTH_WRITEMASK);
                gl.depthMask(true);
                gl.depthFunc(gl.ALWAYS);
                useProgram(programSingle);
                if (programSingle.slideU || programSingle.slideV) {
                    programSingle.slideU = 0;
                    programSingle.slideV = 0;
                    gl.uniform2f(programSingle.slide, 0, 0);
                }
                loadAttribBuffer(programSingle.aVertexPosition, level_1.bufferVertexPosition);
                loadAttribBuffer(programSingle.aVertexTextureCoord, level_1.bufferVertexTextureCoord);
                loadAttribBuffer(programSingle.aVertexLight, level_1.bufferVertexLight);
                loadAttribBuffer(programSingle.aVertexBrightness, level_1.bufferVertexTextureBrightness);
                for (var _i = 0, rgVisibleSides_1 = rgVisibleSides; _i < rgVisibleSides_1.length; _i++) {
                    var side = rgVisibleSides_1[_i];
                    /*DEBUG
                    if (_cubeDebug)
                    {
                        const step = _stepsDebug[_iStep];
                        if (step && step.minPlanes)
                        {
                            $(["left", "right", "bottom", "top"]).each(function (i, e)
                            {
                                const plane = step.minPlanes[i];
                                if (plane)
                                {
                                    gl.uniform3f(programSingle[e + "PlaneAnchor"], plane.anchor.x, plane.anchor.y, plane.anchor.z);
                                    gl.uniform3f(programSingle[e + "PlaneNormal"], plane.normal.x, plane.normal.y, plane.normal.z);
                                }
                            });
                        }
                    }
                    */
                    if (side.program === programSingle) {
                        side.render(time, fWireframe);
                    }
                }
            }
            gl.enable(gl.DEPTH_TEST);
            gl.depthFunc(gl.GEQUAL);
            if (true) {
                useProgram(programDouble);
                if (programDouble.slideU || programDouble.slideV) {
                    programDouble.slideU = 0;
                    programDouble.slideV = 0;
                    gl.uniform2f(programDouble.slide, 0, 0);
                }
                loadAttribBuffer(programDouble.aVertexPosition, level_1.bufferVertexPosition);
                loadAttribBuffer(programDouble.aVertexTextureCoord, level_1.bufferVertexTextureCoord);
                loadAttribBuffer(programDouble.aVertexLight, level_1.bufferVertexLight);
                loadAttribBuffer(programDouble.aVertexBrightness, level_1.bufferVertexTextureBrightness);
                for (var iSide = rgVisibleSides.length; iSide--;) {
                    var side = rgVisibleSides[iSide];
                    if (side.program === programDouble) {
                        side.render(time, fWireframe);
                    }
                }
            }
            /*
            function p()
            {
                const posCurrent = new CubePos(viewer.cube, viewer.pos.addScale(Vec3.Y, .01));
                const posStart = new CubePos(rgCubes[0]);
                const path = posStart.createPathTo(posCurrent);
                if (path)
                {
                    const optimized: CubePos[] = [];
                    for (let iStart = 0; iStart < path.length; ++iStart)
                    {
                        const start = path[iStart];
                        optimized.push(start);

                        const iEnd = iStart + 2;
                        while (iEnd < path.length)
                        {
                            const end = path[iEnd];
                            const bounce = start.bounce(end.pos);
                            if (bounce && bounce.side.isSolid())
                            {
                                --iEnd;
                                break;
                            }
                            ++iEnd;
                        }
                        iStart = iEnd - 1;
                    }
                    optimized.push(path[path.length - 1]);

                    renderPath(optimized);
                }
            }
            p();
            */
            gl.enable(gl.BLEND);
            if (true) {
                for (var iCube = rgVisibleCubes.length; iCube--;) {
                    var cube = rgVisibleCubes[iCube];
                    cube.renderObjects(time);
                }
            }
            if (true) {
                useProgram(programSingle);
                loadAttribBuffer(programSingle.aVertexPosition, level_1.bufferVertexPosition);
                loadAttribBuffer(programSingle.aVertexTextureCoord, level_1.bufferVertexTextureCoord);
                loadAttribBuffer(programSingle.aVertexLight, level_1.bufferVertexLight);
                loadAttribBuffer(programSingle.aVertexBrightness, level_1.bufferVertexTextureBrightness);
                for (var iSide = rgVisibleSidesBlended.length; iSide--;) {
                    var side = rgVisibleSidesBlended[iSide];
                    if (side.program === programSingle) {
                        side.render(time, fWireframe);
                    }
                }
                useProgram(programDouble);
                loadAttribBuffer(programDouble.aVertexPosition, level_1.bufferVertexPosition);
                loadAttribBuffer(programDouble.aVertexTextureCoord, level_1.bufferVertexTextureCoord);
                loadAttribBuffer(programDouble.aVertexLight, level_1.bufferVertexLight);
                loadAttribBuffer(programDouble.aVertexBrightness, level_1.bufferVertexTextureBrightness);
                for (var iSide = rgVisibleSidesBlended.length; iSide--;) {
                    var side = rgVisibleSidesBlended[iSide];
                    if (side.program === programDouble) {
                        side.render(time, fWireframe);
                    }
                }
            }
            /*DEBUG
            if (_cubeDebug)
            {
                gl.disable(gl.BLEND);
                gl.disable(gl.DEPTH_TEST);

                gl.disable(gl.CULL_FACE);

                useProgram(programFlat);

                const step = _stepsDebug[_iStep];

                _stepsDebug._iStep = _iStep;
                _stackDebug.push(_stepsDebug);
                for (let i = _stackDebug.length; i--;)
                {
                    const stepsRender = _stackDebug[i];
                    const stepRender = stepsRender[stepsRender._iStep];
                    const sideOther = stepRender.side;

                    if (!sideOther.bufferVertexTextureBrightness)
                        sideOther.createBuffers();

                    loadAttribBuffer(programFlat.aVertexPosition, sideOther.bufferVertexPosition);
                    if (i === 0)
                        gl.uniform4f(programFlat.color, 1, .5, 1, 0.3);
                    else if (i === _stackDebug.length - 1)
                        gl.uniform4f(programFlat.color, 1, 0, 1, .7);
                    else
                        gl.uniform4f(programFlat.color, 0, .5, 1, 0.07);
                    gl.drawArrays(gl.TRIANGLE_FAN, 0, sideOther.bufferVertexPosition.numItems);
                }
                _stackDebug.pop();

                gl.disable(gl.DEPTH_TEST);

                if (step.extents)
                {
                    useProgram(programBillboard);
                    loadAttribBuffer(programBillboard.aVertexPosition, programBillboard.bufferVertexPosition);

                    for (let i = 4; i--;)
                    {
                        const extent = step.extents[i];
                        if (extent)
                        {
                            gl.uniform3f(programBillboard.pos, extent.x, extent.y, extent.z);

                            const tex = _pig.loadBitmap(i + 1, 1);
                            const bmp = tex.bmp;
                            bindTexture(1, tex)
                            gl.uniform2f(programBillboard.sizeTexture, bmp.width, bmp.height);
                            gl.uniform1f(programBillboard.scale, 2 / Math.max(bmp.width, bmp.height));

                            gl.drawArrays(gl.TRIANGLE_FAN, 0, programBillboard.bufferVertexPosition.numItems);
                        }
                    }

                }

                if (step.rgEdges)
                {
                    useProgram(programFlat);

                    gl.lineWidth(30);

                    for (let iEdge = 4; iEdge--;)
                    {
                        const bufferVertexPositionEdge1 = createBuffer(step.rgEdges[iEdge].flatten(), 3);
                        loadAttribBuffer(programFlat.aVertexPosition, bufferVertexPositionEdge1);
                        switch (iEdge)
                        {
                            case 0:
                                gl.uniform4f(programFlat.color, 1, 0, 0, 1);
                                break;
                            case 1:
                                gl.uniform4f(programFlat.color, 0, 1, 0, 1);
                                break;
                            case 2:
                                gl.uniform4f(programFlat.color, 0, 0, 1, 1);
                                break;
                            case 3:
                                gl.uniform4f(programFlat.color, 1, 1, 0, 1);
                                break;
                        }
                        gl.drawArrays(gl.LINES, 0, 2);
                    }
                }

                gl.enable(gl.DEPTH_TEST);

                if (step.callback && Keys.mapBindings["debug"].pressed)
                    step.callback();

                gl.enable(gl.CULL_FACE);
            }
            */
        };
        console.log("start animation");
        _animationFunction = drawAnimationFrame;
        animate();
    }
}

//# sourceMappingURL=index.js.map
