"use strict";

interface Array<T>
{
	checkIndex(i: number):void;
	mapConcat(callback: any, thisArg: any): any[];
	removeAt(i: number): T;
	swapOut(i: number): T;
}
interface Math
{
	round(value: number, digits: number):number;
	mod(a: number, b: number):number;
}
(function (Math:any, Array:any)
{
	var _round = Math.round;
	var _rgPowers = new Float32Array(10);

	Math.round = function (value: number, digits: number)
	{
		if (typeof digits === 'undefined')
			return _round(value);

		if (digits >= 0 || digits < 10)
		{
			var scale = _rgPowers[digits];
			if (!scale)
				scale = _rgPowers[digits] = Math.pow(10, digits);
			return _round(value * scale) / scale;
		}
		else
		{
			throw new Error("invalid precision: " + digits);
		}
	}
	Math.mod = function (a: number, b: number)
	{
		return a - b * Math.floor(a / b);
	}
})(Math, Array);

Array.prototype.mapConcat = function (callback: any, thisArg: any): any[]
{
	var rg:any[] = [];
	var push = Array.prototype.push;
	for (var i = 0; i < this.length; ++i)
		push.apply(rg, callback.call(thisArg, this[i], i, this));
	return rg;
}
Array.prototype.checkIndex = function (i: number)
{
	if (i < 0 || i >= this.length)
		throw new Error("index out of range: " + i);
}
Array.prototype.removeAt = function (i: number)
{
	this.checkIndex(i);
	var old = this[i];
	this.splice(i, 1);
	return old;
}
Array.prototype.swapOut = function (i: number): any
{
	this.checkIndex(i);
	var old = this[i];
	var other: any = this.pop();
	if (this.length)
		this[i] = other;
	return old;
}
function Array_iterate(count: number, callback: (i: number) => any)
{
	var rg:any[] = [];
	for (var i = 0; i < count; ++i)
	{
		var value = callback(i);
		if (typeof value !== 'undefined')
			rg.push(value);
	}
	return rg;
}
var __unique = 1;


function fix(v: number) { return v / 65536; }
function fix2(v: number) { return v / 256; }

class Vec2
{
	constructor(public x: number, public y: number)
	{
		if (isNaN(x) || isNaN(y))
			throw new Error("invalid value");
	}
	add(v: Vec2)
	{
		return new Vec2(this.x + v.x, this.y + v.y);
	}
	addScale(v: Vec2, scale: number)
	{
		return new Vec2(this.x + v.x * scale, this.y + v.y * scale);
	}
	sub(v: Vec2)
	{
		return new Vec2(this.x - v.x, this.y - v.y);
	}
	scale(s: number)
	{
		if (s === 0)
			return Vec2.Zero;
		if (s === 1)
			return this;
		return new Vec2(this.x * s, this.y * s);
	}
	unit()
	{
		var len = this.len2();
		if (len === 1)
			return this;
		return this.scale(1 / Math.sqrt(len));
	}
	len2()
	{
		return this.x * this.x + this.y * this.y;
	}
	len()
	{
		return Math.sqrt(this.len2());
	}
	dot(v: Vec2)
	{
		return this.x * v.x + this.y * v.y;
	}
	projectOnTo(n: Vec2)
	{
		return n.scale(n.dot(this) / n.len());
	}
	pushTo(array: number[])
	{
		array.push(this.x, this.y);
	}
	_flattened: number[];
	flatten()
	{
		var flattened = this._flattened;
		if (!flattened)
			flattened = this._flattened = [this.x, this.y];
		return flattened;
	}
	toString()
	{
		return "(" + Math.round(this.x, 3) + ", " + Math.round(this.y, 3) + ")";
	}
	static Zero = new Vec2(0, 0);
	static One = new Vec2(1, 1);
	static X = new Vec2(1, 0);
	static Y = new Vec2(0, 1);
}
class Vec3
{
	constructor(public x: number, public y: number, public z: number)
	{
		if (isNaN(x) || isNaN(y) || isNaN(z))
			throw new Error("invalid value");
	}
	add(v: Vec3)
	{
		return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
	}
	addScale(v: Vec3, scale: number)
	{
		return new Vec3(this.x + v.x * scale, this.y + v.y * scale, this.z + v.z * scale);
	}
	sub(v: Vec3)
	{
		return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
	}
	scale(s: number)
	{
		if (s === 0)
			return Vec3.Zero;
		if (s === 1)
			return this;
		return new Vec3(this.x * s, this.y * s, this.z * s);
	}
	unit()
	{
		var len = this.len2();
		if (len === 1)
			return this;
		return this.scale(1 / Math.sqrt(len));
	}
	len2()
	{
		return this.x * this.x + this.y * this.y + this.z * this.z;
	}
	_len: number;
	len()
	{
		var len = this._len;
		if (!len)
			len = this._len = Math.sqrt(this.len2());
		return len;
	}
	dot(v: Vec3)
	{
		return this.x * v.x + this.y * v.y + this.z * v.z;
	}
	neg()
	{
		return new Vec3(-this.x, -this.y, -this.z);
	}
	cross(v: Vec3)
	{
		return new Vec3(
			this.y * v.z - v.y * this.z,
			this.z * v.x - v.z * this.x,
			this.x * v.y - v.x * this.y
			);
	}
	projectOnTo(n: Vec3)
	{
		return n.scale(n.dot(this) / n.len());
	}
	projectOnToPlane(normal: Vec3)
	{
		return this.sub(this.projectOnTo(normal));
	}
	planeNormal(p1: Vec3, p2: Vec3)
	{
		var v1 = p1.sub(this);
		var v2 = p2.sub(this);
		return v1.cross(v2).unit();
	}
	distanceTo(p: Vec3)
	{
		return Math.sqrt(this.distanceTo2(p));
	}
	distanceTo2(p: Vec3)
	{
		var dx = this.x - p.x;
		var dy = this.y - p.y;
		var dz = this.z - p.z;
		return dx * dx + dy * dy + dz * dz;
	}
	distanceToPlane(p: Vec3, n: Vec3)
	{
		return this.sub(p).dot(n);
	}
	pushTo(array: number[])
	{
		array.push(this.x, this.y, this.z);
	}
	_flattened: number[];
	flatten()
	{
		var flattened = this._flattened;
		if (!flattened)
			flattened = this._flattened = [this.x, this.y, this.z];
		return flattened;
	}
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

	toString()
	{
		return "(" + Math.round(this.x, 3) + ", " + Math.round(this.y, 3) + ", " + Math.round(this.z, 3) + ")";
	}
	static Zero = new Vec3(0, 0, 0);
	static One = new Vec3(1, 1, 1);
	static X = new Vec3(1, 0, 0);
	static Y = new Vec3(0, 1, 0);
	static Z = new Vec3(0, 0, 1);
}
class Line3
{
	constructor(public start: Vec3, public direction: Vec3)
	{
	}
	distanceToPlane(plane: Plane3)
	{
		var dotprod = this.direction.dot(plane.normal.unit());
		if (dotprod <= 0)
			return;	// wrong direction

		return plane.anchor.sub(this.start).dot(plane.normal) / dotprod;
	}
	intersectPlane(plane: Plane3)
	{
		var distance = this.distanceToPlane(plane);
		if (isNaN(distance))
			return;

		return this.proceed(distance);
	}
	interesctTriangle(tri: Triangle)
	{
		var pt = this.intersectPlane(tri);
		if (tri.containsPoint(pt))
			return pt;
		return null;
	}
	proceed(distance: number): Vec3
	{
		return this.start.addScale(this.direction, distance / this.direction.len());
	}

}
class LineSegment extends Line3
{
	length: number;
	end: Vec3;

	constructor(start: Vec3, end: Vec3)
	{
		var direction = end.sub(start);
		var length = direction.len();
		super(start, direction.scale(1 / length));

		this.length = length;
		this.end = end;
	}
	center()
	{
		return this.proceed(this.length / 2);
	}
	distanceToSphere(center: Vec3, radius: number): number
	{
		var c = center.sub(this.start);
		var l = this.direction;

		var A = l.dot(c);
		var B = l.dot(l);
		var Q = A * A - B * (c.dot(c) - radius * radius);

		if (Q <= 0.0)
			return NaN;

		var d = (A - Math.sqrt(Q)) / B;
		if (d <= 0.0)
			return NaN;
		return d;
		/*

		var d = this.direction;

		var a = d.dot(d);
		var b = 2.0 * d.dot(this.start.sub(center));
		var c = center.dot(center) + this.start.dot(this.start) - 2.0 * center.dot(this.start) - radius * radius;

		var test = b * b - 4.0 * a * c;
		if (test <= 0.0)
			return;

		// Hit
		var u = (-b - Math.sqrt(test)) / (2.0 * a);
		return u / d.len();
		*/
	}
	_flattened: number[];
	flatten()
	{
		var flattened = this._flattened;
		if (!flattened)
			flattened = this._flattened = [this.start.x, this.start.y, this.start.z, this.end.x, this.end.y, this.end.z];
		return flattened;
	}
	intersectPlane(plane: Plane3)
	{
		var distance = this.distanceToPlane(plane);
		if (isNaN(distance))
			return;

		if (distance > this.length)
			return;	// too far away

		return this.proceed(distance);
	}
}
class Plane3
{
	constructor(public anchor: Vec3, public normal: Vec3)
	{
	}
	distanceTo(pt: Vec3)
	{
		var n = this.normal;
		var a = this.anchor;

		return n.x * (pt.x - a.x) + n.y * (pt.y - a.y) + n.z * (pt.z - a.z);
	}
	reverse()
	{
		return new Plane3(this.anchor, this.normal.scale(-1));
	}
	pointClosestTo(vec: Vec3)
	{
		return vec.addScale(this.normal, -vec.dot(this.normal));
	}
	reflectVector(vec: Vec3)
	{
		return vec.addScale(this.normal, -2 * vec.dot(this.normal));
	}
	reflectPoint(pt: Vec3)
	{
		return this.anchor.add(this.reflectVector(pt.sub(this.anchor)));
	}
	toString()
	{
		return this.anchor.toString() + "/" + this.normal.toString();
	}
	toReflectionMatrix()
	{
		var x = this.normal.x;
		var y = this.normal.y;
		var z = this.normal.z;

		return new Mat3(
			new Vec3(1 - 2 * x * x, -2 * x * y, -2 * x * z),
			new Vec3(-2 * x * y, 1 - 2 * y * y, -2 * y * z),
			new Vec3(-2 * z * x, -2 * z * y, 1 - 2 * z * z)
			);
	}
	static fromPoints(v0: Vec3, v1: Vec3, v2: Vec3)
	{
		var u = v1.sub(v0);
		var v = v2.sub(v0);
		var normal = u.cross(v);
		return new Plane3(v0, normal);
	}
}
class Bounce extends Plane3
{
	iTri: number;
	tri: Triangle;
	perpendicularDistance: number;
	distance: number;
	cube: Cube;
	side: Side;

	getTextureCoords(): Vec2
	{
		var side = this.side;
		var rgUV = side.rgUV;

		var uv0 = rgUV[0];
		var uv1: Vec2, uv2: Vec2;
		if (this.iTri === 0)
		{
			uv1 = rgUV[1].sub(uv0);
			uv2 = rgUV[2].sub(uv0);
		}
		else
		{
			uv1 = rgUV[2].sub(uv0);
			uv2 = rgUV[3].sub(uv0);
		}

		var uv = this.tri.getParametricCoords(this.anchor);
		var v = uv0.addScale(uv1, uv.x).addScale(uv2, uv.y);
		return v;
	}
}
class Triangle extends Plane3
{
	rgPoints: Vec3[];
	u: Vec3;
	v: Vec3;
	uu: number;
	uv: number;
	vv: number;
	D: number;

	center: Vec3;

	constructor(v0: Vec3, v1: Vec3, v2: Vec3)
	{
		this.rgPoints = [v0, v1, v2];

		this.u = v1.sub(v0);
		this.v = v2.sub(v0);

		this.uu = this.u.dot(this.u);
		this.uv = this.u.dot(this.v);
		this.vv = this.v.dot(this.v);
		this.D = this.uv * this.uv - this.uu * this.vv;

		var normal = this.u.cross(this.v).unit();
		super(v0, normal);
	}
	containsPoint(pt: Vec3)
	{
		var w = pt.sub(this.anchor);
		var wu = w.dot(this.u);
		var wv = w.dot(this.v);

		// get and test parametric coords
		var s = (this.uv * wv - this.vv * wu) / this.D;
		if (s < 0.0 || s > 1.0)
			return false;

		var t = (this.uv * wu - this.uu * wv) / this.D;
		if (t < 0.0 || (s + t) > 1.0)
			return false;

		return true;
	}
	getParametricCoords(pt: Vec3)
	{
		var w = pt.sub(this.anchor);

		// Compute dot products
		var uw = this.u.dot(w);
		var vw = this.v.dot(w);

		// Compute barycentric coordinates
		var u = (this.uv * vw - this.vv * uw) / this.D;
		var v = (this.uv * uw - this.uu * vw) / this.D;

		return new Vec2(u, v);
	}
	/*
	getProjectionMatrix()
	{
		var mat = Matrix.create([
			this.u.toV3(),
			this.v.projectOnTo(this.u.cross(this.normal)).toV3(),
			this.normal.scale(this.u.len()).toV3()
		]);
	
		mat = mat.ensure4x4();
	
		mat = mat.inverse();
		mat = mat.transpose();
	
		var mt = Matrix.Translation(Vec3.Zero.sub(this.anchor).toV3());
		mat = mat.multiply(mt);
	
		return mat;
	}
	*/

	getCenter()
	{
		if (!this.center)
		{
			this.center = this.rgPoints[0]
				.add(this.rgPoints[1])
				.add(this.rgPoints[2])
				.scale(1 / 3);
		}
		return this.center;
	}
	bounce(line: LineSegment, size: number)
	{
		var dotProduct = -this.normal.dot(line.direction);
		if (dotProduct <= 0)
			return;	// triangle faces the wrong direction

		// the perpendicular distance from the start of the line to the plane
		var perpendicularDistanceToStart = this.distanceTo(line.start);

		// the distance from the start of the line to the point of collision
		var perpendicularDistanceToCollision = perpendicularDistanceToStart - size;

		// the distance along the line from the start to the collision
		var distanceToCollision = perpendicularDistanceToCollision / dotProduct;
		if (distanceToCollision > line.length)
			return;	// too far away

		var contactPoint = line.proceed(distanceToCollision);
		if (!this.containsPoint(contactPoint))
			return;

		var bounce = new Bounce(contactPoint, this.normal);
		bounce.tri = this;
		bounce.perpendicularDistance = perpendicularDistanceToCollision;
		bounce.distance = distanceToCollision;
		return bounce;


		/*
		var perpendicularDistance = this.distanceTo(line.end);

		// the distance perpendicular to the plane that we've overshot
		var perpendicularPenetration = size - perpendicularDistance;

		if (perpendicularPenetration < 1e-13)
			return;	// too far away

		// the distance along the line that we've overshot
		var penetration = -perpendicularPenetration / dotProduct;

		// the point at which contact occurred
		var contactPoint = line.end.addScale(line.direction, -penetration);
		if (!this.containsPoint(contactPoint))
			return;

		var bounce = new Plane3(contactPoint, this.normal);
		bounce.tri = this;
		bounce.perpendicularDistance = perpendicularDistance;
		bounce.distance = line.length - penetration;
		return bounce;
		*/
	}
}
class Mat3
{
	_: Vec3[];

	constructor(rows: Vec3[]);
	constructor(r0: Vec3, r1: Vec3, r2: Vec3);
	constructor(r0: any, r1?: Vec3, r2?: Vec3)
	{
		if (r0 instanceof Array)
		{
			if (r0.length !== 3)
				throw new Error("wrong length: " + r0.length);
			if (typeof r1 !== 'undefined' || typeof r2 !== 'undefined')
				throw new Error("can't pass additional arguments here");
			this._ = r0;
		}
		else
		{
			this._ = [r0, r1, r2];
		}

		//Object.freeze(this);
	}
	add(other: Mat3)
	{
		return new Mat3(
			this._[0].add(other._[0]),
			this._[1].add(other._[1]),
			this._[2].add(other._[2])
			);
	}
	sub(other: Mat3)
	{
		return new Mat3(
			this._[0].sub(other._[0]),
			this._[1].sub(other._[1]),
			this._[2].sub(other._[2])
			);
	}
	scale(value: number)
	{
		return new Mat3(
			this._[0].scale(value),
			this._[1].scale(value),
			this._[2].scale(value)
			);
	}
	multiply(other: Vec3): Vec3;
	multiply(other: Mat3): Mat3;

	multiply(other: any): any
	{
		if (other instanceof Vec3)
		{
			return this._[0].scale(other.x)
				.addScale(this._[1], other.y)
				.addScale(this._[2], other.z);
		}

		var rows:Vec3[] = [];

		for (var i = 0; i < 3; ++i)
		{
			var vx =
				this._[i].x * other._[0].x +
				this._[i].y * other._[1].x +
				this._[i].z * other._[2].x;

			var vy =
				this._[i].x * other._[0].y +
				this._[i].y * other._[1].y +
				this._[i].z * other._[2].y;

			var vz =
				this._[i].x * other._[0].z +
				this._[i].y * other._[1].z +
				this._[i].z * other._[2].z;

			rows.push(new Vec3(vx, vy, vz));
		}

		return new Mat3(rows);
	}
	transpose()
	{
		return new Mat3([
			new Vec3(this._[0].x, this._[1].x, this._[2].x),
			new Vec3(this._[0].y, this._[1].y, this._[2].y),
			new Vec3(this._[0].z, this._[1].z, this._[2].z)
		]);
	}
	rotate(v: Vec3)
	{
		return new Vec3(
			this._[0].dot(v),
			this._[1].dot(v),
			this._[2].dot(v)
			);
	}
	rotate2d(angle: number)
	{
		return Mat3.createRotation2d(angle).multiply(this);
	}
	translate2d(x: number, y: number)
	{
		return Mat3.createTranslation2d(x, y).multiply(this);
	}
	_flattened: number[];
	flatten()
	{
		var flattened = this._flattened;
		if (!flattened)
		{
			flattened = this._flattened = [];
			this._[0].pushTo(flattened);
			this._[1].pushTo(flattened);
			this._[2].pushTo(flattened);
		}
		return flattened;
	}

	toMat4(): Mat4
	{
		return new Mat4([
			[this._[0].x, this._[0].y, this._[0].z, 0],
			[this._[1].x, this._[1].y, this._[1].z, 0],
			[this._[2].x, this._[2].y, this._[2].z, 0],
			[0, 0, 0, 1],
		]);
	}
	static I = new Mat3(Vec3.X, Vec3.Y, Vec3.Z);

	static createRotation2d(angle: number)
	{
		var c = Math.cos(angle);
		var s = Math.sin(angle);
		return new Mat3(
			new Vec3(c, -s, 0),
			new Vec3(s, c, 0),
			Vec3.Z
			);
	}
	static createTranslation2d(x: Vec2): Mat3;
	static createTranslation2d(x: number, y: number): Mat3;
	static createTranslation2d(x: any, y?: number): Mat3
	{
		if (x instanceof Vec2)
		{
			y = x.y;
			x = x.x;
		}

		return new Mat3(
			new Vec3(1, 0, x),
			new Vec3(0, 1, y),
			Vec3.Z
			);
	}
	static fromEuler(p: Vec3): Mat3;
	static fromEuler(p: number, h: number, b: number): Mat3;

	static fromEuler(p: any, h?: any, b?: any): Mat3
	{
		if (p instanceof Vec3)
		{
			b = p.z;
			h = p.y;
			p = p.x;
		}

		var
			sinp = Math.sin(p),
			cosp = Math.cos(p),
			sinb = Math.sin(b),
			cosb = Math.cos(b),
			sinh = Math.sin(h),
			cosh = Math.cos(h);

		var sbsh = sinb * sinh;
		var cbch = cosb * cosh;
		var cbsh = cosb * sinh;
		var sbch = sinb * cosh;

		return new Mat3(
			new Vec3(cbch + sinp * sbsh, sinb * cosp, sinp * sbch - cbsh),
			new Vec3(sinp * cbsh - sbch, cosb * cosp, sbsh + sinp * cbch),
			new Vec3(sinh * cosp, -sinp, cosh * cosp)
			);
	}
	static createLook = function (forward: Vec3, up?: Vec3, right?: Vec3)
	{
		var x: Vec3, y: Vec3, z: Vec3 = forward.unit();

		if (up)
		{
			y = up.unit();
			x = y.cross(z);
		}
		else
		{
			if (right)
				x = right.unit();
			else
				x = new Vec3(z.z, 0, -z.x).unit();
			y = z.cross(x);
		}
		return new Mat3(x, y, z);
	}
	static createRotation(angles: Vec3): Mat3
	{
		var
			sinp = Math.sin(angles.x),
			cosp = Math.cos(angles.x),
			sinb = Math.sin(angles.z),
			cosb = Math.cos(angles.z),
			sinh = Math.sin(angles.y),
			cosh = Math.cos(angles.y);

		var sbsh = sinb * sinh;
		var cbch = cosb * cosh;
		var cbsh = cosb * sinh;
		var sbch = sinb * cosh;

		return new Mat3(
			new Vec3 (cbch + sinp * sbsh, sinb * cosp, sinp * sbch - cbsh),
			new Vec3 (sinp * cbsh - sbch, cosb * cosp, sbsh + sinp * cbch),
			new Vec3 (sinh * cosp, -sinp, cosh * cosp)
		);

	}

}
class Mat4
{
	elements: Float32Array;

	constructor(rows: number[][]);
	constructor(elements: Float32Array);
	constructor(arg: any)
	{
		if (arg[0].length)
		{
			this.elements = new Float32Array(16);
			for (var col = 4; col--;)
				for (var row = 4; row--;)
					this.elements[row + col * 4] = arg[row][col];
		}
		else
		{
			this.elements = arg;
		}
	}

	multiply(m: Mat4): Mat4
	{
		var eltsL = this.elements;
		var eltsR = m.elements;

		var res = new Float32Array(16);

		for (var row = 4; row--;)
		{
			for (var col = 4; col--;)
			{
				res[row + col * 4] =
				eltsL[row + 0 * 4] * eltsR[0 + col * 4] +
				eltsL[row + 1 * 4] * eltsR[1 + col * 4] +
				eltsL[row + 2 * 4] * eltsR[2 + col * 4] +
				eltsL[row + 3 * 4] * eltsR[3 + col * 4];
			}
		}

		return new Mat4(res);
	}
	flatten() { return this.elements; }

	getRow(row: number): number[]
	{
		return [
			this.elements[row + 0 * 4],
			this.elements[row + 1 * 4],
			this.elements[row + 2 * 4],
			this.elements[row + 3 * 4]
		];
	}


	static I: Mat4 = new Mat4([
		[1, 0, 0, 0],
		[0, 1, 0, 0],
		[0, 0, 1, 0],
		[0, 0, 0, 1],
	]);

	static createTranslation(t: Vec3): Mat4
	{
		return new Mat4([
			[1, 0, 0, t.x],
			[0, 1, 0, t.y],
			[0, 0, 1, t.z],
			[0, 0, 0, 1],
		]);
	}
	// from http://en.wikibooks.org/wiki/GLSL_Programming/Vertex_Transformations
	static createFrustum(l: number, r: number, b: number, t: number, n: number, f: number): Mat4
	{
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
			[0, 0, 1, 0]
		]);
	}

	static createPerspective(fovy: number, aspect: number, znear: number, zfar: number): Mat4
	{
		var ymax = znear * Math.tan(fovy * Math.PI / 360.0);
		var ymin = -ymax;
		var xmin = ymin * aspect;
		var xmax = ymax * aspect;

		return Mat4.createFrustum(xmin, xmax, ymin, ymax, znear, zfar);
	}


	static createPerspective2(fovy: number, aspect: number, near: number, far: number): Mat4
	{
		const out = new Float32Array(16);

		const f = 1.0 / Math.tan(fovy / 2),
			nf = 1 / (near - far);

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
	}


	static createLookAt(cameraPosition: Vec3, cameraTarget: Vec3, cameraUpVector: Vec3): Mat4
	{
		const vz = cameraPosition.sub(cameraTarget).unit();
		const vx = cameraUpVector.cross(vz).unit();
		const vy = vz.cross(vx);

		const tx = -vx.dot(cameraPosition);
		const ty = -vy.dot(cameraPosition);
		const tz = -vz.dot(cameraPosition);

		return new Mat4([
			[vx.x, vy.x, vz.x, 0],
			[vx.y, vy.y, vz.y, 0],
			[vx.z, vy.z, vz.z, 0],
			[tx, ty, tz, 1		]
		]);
	}

}