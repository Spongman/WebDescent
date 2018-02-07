"use strict";

interface Array<T> {
	checkIndex(i: number): void;
	mapConcat(callback: any, thisArg: any): any[];
	removeAt(i: number): T;
	swapOut(i: number): T;
}
interface Math {
	round(value: number, digits: number): number;
	mod(a: number, b: number): number;
}
((Math: any, Array: any) => {
	const _round = Math.round;
	const _rgPowers = new Float32Array(10);

	Math.round = (value: number, digits?: number) => {
		if (digits == null) {
			return _round(value);
		}

		if (digits >= 0 || digits < 10) {
			let scale = _rgPowers[digits];
			if (!scale) {
				scale = _rgPowers[digits] = Math.pow(10, digits);
			}
			return _round(value * scale) / scale;
		} else {
			throw new Error("invalid precision: " + digits);
		}
	};
	Math.mod = (a: number, b: number) => {
		return a - b * Math.floor(a / b);
	};
})(Math, Array);

function assert(f: boolean) {
	if (!f) {
		throw new Error("assertion failed");
	}
}

function notNull<T>(f: T | null | undefined): T {
	if (f == null) {
		throw new Error("unexpected null|undefined");
	}
	return f;
}

Array.prototype.mapConcat = function(callback: any, thisArg: any): any[] {
	const rg: any[] = [];
	const push = Array.prototype.push;
	for (let i = 0; i < this.length; ++i) {
		push.apply(rg, callback.call(thisArg, this[i], i, this));
	}
	return rg;
};
Array.prototype.checkIndex = function(i: number) {
	if (i < 0 || i >= this.length) {
		throw new Error("index out of range: " + i);
	}
};
Array.prototype.removeAt = function(i: number) {
	this.checkIndex(i);
	const old = this[i];
	this.splice(i, 1);
	return old;
};
Array.prototype.swapOut = function(i: number): any {
	this.checkIndex(i);
	const old = this[i];
	const other: any = this.pop();
	if (this.length && old !== other) {
		this[i] = other;
	}
	return old;
};
function Array_iterate(count: number, callback: (i: number) => any) {
	const rg: any[] = [];
	for (let i = 0; i < count; ++i) {
		const value = callback(i);
		if (typeof value !== "undefined") {
			rg.push(value);
		}
	}
	return rg;
}
let __unique = 1;

function fix(v: number) { return v / 65536; }
function fix2(v: number) { return v / 256; }

class Vec2 {
	static Zero = new Vec2(0, 0);
	static One = new Vec2(1, 1);
	static X = new Vec2(1, 0);
	static Y = new Vec2(0, 1);

	private _flattened: number[];

	constructor(public x: number, public y: number) {
		if (isNaN(x) || isNaN(y)) {
			throw new Error("invalid value");
		}
	}
	add(v: Vec2) {
		return new Vec2(this.x + v.x, this.y + v.y);
	}
	addScale(v: Vec2, scale: number) {
		return new Vec2(this.x + v.x * scale, this.y + v.y * scale);
	}
	sub(v: Vec2) {
		return new Vec2(this.x - v.x, this.y - v.y);
	}
	scale(s: number) {
		if (s === 0) {
			return Vec2.Zero;
		}
		if (s === 1) {
			return this;
		}
		return new Vec2(this.x * s, this.y * s);
	}
	unit() {
		const len = this.len2();
		if (len === 1) {
			return this;
		}
		return this.scale(1 / Math.sqrt(len));
	}
	len2() {
		return this.x * this.x + this.y * this.y;
	}
	len() {
		return Math.sqrt(this.len2());
	}
	dot(v: Vec2) {
		return this.x * v.x + this.y * v.y;
	}
	projectOnTo(n: Vec2) {
		return n.scale(n.dot(this) / n.len());
	}
	pushTo(array: number[]) {
		array.push(this.x, this.y);
	}

	flatten() {
		let flattened = this._flattened;
		if (!flattened) {
			flattened = this._flattened = [this.x, this.y];
		}
		return flattened;
	}
	toString() {
		return "(" + Math.round(this.x, 3) + ", " + Math.round(this.y, 3) + ")";
	}
}
class Vec3 {
	static Zero = new Vec3(0, 0, 0);
	static One = new Vec3(1, 1, 1);
	static X = new Vec3(1, 0, 0);
	static Y = new Vec3(0, 1, 0);
	static Z = new Vec3(0, 0, 1);

	private _len: number;
	private _flattened: number[];

	constructor(public x: number, public y: number, public z: number) {
		if (isNaN(x) || isNaN(y) || isNaN(z)) {
			throw new Error("invalid value");
		}
	}
	add(v: Vec3) {
		return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
	}
	addScale(v: Vec3, scale: number) {
		return new Vec3(this.x + v.x * scale, this.y + v.y * scale, this.z + v.z * scale);
	}
	sub(v: Vec3) {
		return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
	}
	scale(s: number) {
		if (s === 0) {
			return Vec3.Zero;
		}
		if (s === 1) {
			return this;
		}
		return new Vec3(this.x * s, this.y * s, this.z * s);
	}
	unit() {
		const len = this.len2();
		if (len === 1) {
			return this;
		}
		return this.scale(1 / Math.sqrt(len));
	}
	len2() {
		return this.x * this.x + this.y * this.y + this.z * this.z;
	}
	len() {
		let len = this._len;
		if (!len) {
			len = this._len = Math.sqrt(this.len2());
		}
		return len;
	}
	dot(v: Vec3) {
		return this.x * v.x + this.y * v.y + this.z * v.z;
	}
	neg() {
		return new Vec3(-this.x, -this.y, -this.z);
	}
	cross(v: Vec3) {
		return new Vec3(
			this.y * v.z - v.y * this.z,
			this.z * v.x - v.z * this.x,
			this.x * v.y - v.x * this.y,
		);
	}
	projectOnTo(n: Vec3) {
		return n.scale(n.dot(this) / n.len());
	}
	projectOnToPlane(normal: Vec3) {
		return this.sub(this.projectOnTo(normal));
	}
	planeNormal(p1: Vec3, p2: Vec3) {
		const v1 = p1.sub(this);
		const v2 = p2.sub(this);
		return v1.cross(v2).unit();
	}
	distanceTo(p: Vec3) {
		return Math.sqrt(this.distanceTo2(p));
	}
	distanceTo2(p: Vec3) {
		const dx = this.x - p.x;
		const dy = this.y - p.y;
		const dz = this.z - p.z;
		return dx * dx + dy * dy + dz * dz;
	}
	distanceToPlane(p: Vec3, n: Vec3) {
		return this.sub(p).dot(n);
	}
	pushTo(array: number[]) {
		array.push(this.x, this.y, this.z);
	}
	flatten() {
		let flattened = this._flattened;
		if (!flattened) {
			flattened = this._flattened = [this.x, this.y, this.z];
		}
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

	toString() {
		return "(" + Math.round(this.x, 3) + ", " + Math.round(this.y, 3) + ", " + Math.round(this.z, 3) + ")";
	}
}
class Line3 {
	constructor(public start: Vec3, public direction: Vec3) {
	}
	distanceToPlane(plane: Plane3) {
		const dotprod = this.direction.dot(plane.normal.unit());
		if (dotprod <= 0) {
			return null;
		}	// wrong direction

		return plane.anchor.sub(this.start).dot(plane.normal) / dotprod;
	}
	intersectPlane(plane: Plane3) {
		const distance = this.distanceToPlane(plane);
		if (!distance) {
			return null;
		}

		return this.proceed(distance);
	}
	interesctTriangle(tri: Triangle) {
		const pt = this.intersectPlane(tri);
		if (pt && tri.containsPoint(pt)) {
			return pt;
		}
		return null;
	}
	proceed(distance: number): Vec3 {
		return this.start.addScale(this.direction, distance / this.direction.len());
	}

}
class LineSegment extends Line3 {
	length: number;
	end: Vec3;

	private _flattened: number[];

	constructor(start: Vec3, end: Vec3) {
		const direction = end.sub(start);
		const length = direction.len();
		super(start, direction.scale(1 / length));

		this.length = length;
		this.end = end;
	}
	center() {
		return this.proceed(this.length / 2);
	}
	distanceToSphere(center: Vec3, radius: number): number {
		const c = center.sub(this.start);
		const l = this.direction;

		const A = l.dot(c);
		const B = l.dot(l);
		const Q = A * A - B * (c.dot(c) - radius * radius);

		if (Q <= 0.0) {
			return NaN;
		}

		const d = (A - Math.sqrt(Q)) / B;
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
	}

	flatten() {
		let flattened = this._flattened;
		if (!flattened) {
			flattened = this._flattened = [this.start.x, this.start.y, this.start.z, this.end.x, this.end.y, this.end.z];
		}
		return flattened;
	}
	intersectPlane(plane: Plane3) {
		const distance = this.distanceToPlane(plane);
		if (!distance) {
			return null;
		}

		if (distance > this.length) {
			return null;
		}	// too far away

		return this.proceed(distance);
	}
}
class Plane3 {
	static fromPoints(v0: Vec3, v1: Vec3, v2: Vec3) {
		const u = v1.sub(v0);
		const v = v2.sub(v0);
		const normal = u.cross(v);
		return new Plane3(v0, normal);
	}

	constructor(public anchor: Vec3, public normal: Vec3) {
	}
	distanceTo(pt: Vec3) {
		const n = this.normal;
		const a = this.anchor;

		return n.x * (pt.x - a.x) + n.y * (pt.y - a.y) + n.z * (pt.z - a.z);
	}
	reverse() {
		return new Plane3(this.anchor, this.normal.scale(-1));
	}
	pointClosestTo(vec: Vec3) {
		return vec.addScale(this.normal, -vec.dot(this.normal));
	}
	reflectVector(vec: Vec3) {
		return vec.addScale(this.normal, -2 * vec.dot(this.normal));
	}
	reflectPoint(pt: Vec3) {
		return this.anchor.add(this.reflectVector(pt.sub(this.anchor)));
	}
	toString() {
		return this.anchor.toString() + "/" + this.normal.toString();
	}
	toReflectionMatrix() {
		const x = this.normal.x;
		const y = this.normal.y;
		const z = this.normal.z;

		return new Mat3(
			new Vec3(1 - 2 * x * x, -2 * x * y, -2 * x * z),
			new Vec3(-2 * x * y, 1 - 2 * y * y, -2 * y * z),
			new Vec3(-2 * z * x, -2 * z * y, 1 - 2 * z * z),
		);
	}
}
class Bounce extends Plane3 {
	iTri: number;
	tri: Triangle;
	perpendicularDistance: number;
	distance: number;
	cube: Cube;
	side: Side;

	getTextureCoords(): Vec2 {
		const side = this.side;
		const rgUV = side.rgUV;

		const uv0 = rgUV[0];
		let uv1: Vec2;
		let uv2: Vec2;
		if (this.iTri === 0) {
			uv1 = rgUV[1].sub(uv0);
			uv2 = rgUV[2].sub(uv0);
		} else {
			uv1 = rgUV[2].sub(uv0);
			uv2 = rgUV[3].sub(uv0);
		}

		const uv = this.tri.getParametricCoords(this.anchor);
		const v = uv0.addScale(uv1, uv.x).addScale(uv2, uv.y);
		return v;
	}
}
class Triangle extends Plane3 {
	rgPoints: Vec3[];
	u: Vec3;
	v: Vec3;
	uu: number;
	uv: number;
	vv: number;
	D: number;

	center: Vec3;

	constructor(v0: Vec3, v1: Vec3, v2: Vec3) {
		const u = v1.sub(v0);
		const v = v2.sub(v0);
		const normal = u.cross(v).unit();

		super(v0, normal);
		this.rgPoints = [v0, v1, v2];

		this.u = u;
		this.v = v;

		this.uu = u.dot(u);
		this.uv = u.dot(v);
		this.vv = v.dot(v);
		this.D = this.uv * this.uv - this.uu * this.vv;

	}
	containsPoint(pt: Vec3) {
		const w = pt.sub(this.anchor);
		const wu = w.dot(this.u);
		const wv = w.dot(this.v);

		// get and test parametric coords
		const s = (this.uv * wv - this.vv * wu) / this.D;
		if (s < 0.0 || s > 1.0) {
			return false;
		}

		const t = (this.uv * wu - this.uu * wv) / this.D;
		if (t < 0.0 || (s + t) > 1.0) {
			return false;
		}

		return true;
	}
	getParametricCoords(pt: Vec3) {
		const w = pt.sub(this.anchor);

		// Compute dot products
		const uw = this.u.dot(w);
		const vw = this.v.dot(w);

		// Compute barycentric coordinates
		const u = (this.uv * vw - this.vv * uw) / this.D;
		const v = (this.uv * uw - this.uu * vw) / this.D;

		return new Vec2(u, v);
	}
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

	getCenter() {
		if (!this.center) {
			this.center = this.rgPoints[0]
				.add(this.rgPoints[1])
				.add(this.rgPoints[2])
				.scale(1 / 3);
		}
		return this.center;
	}
	bounce(line: LineSegment, size: number) {
		const dotProduct = -this.normal.dot(line.direction);
		if (dotProduct <= 0) {
			return;
		}	// triangle faces the wrong direction

		// the perpendicular distance from the start of the line to the plane
		const perpendicularDistanceToStart = this.distanceTo(line.start);

		// the distance from the start of the line to the point of collision
		const perpendicularDistanceToCollision = perpendicularDistanceToStart - size;

		// the distance along the line from the start to the collision
		const distanceToCollision = perpendicularDistanceToCollision / dotProduct;
		if (distanceToCollision > line.length) {
			return;
		}	// too far away

		const contactPoint = line.proceed(distanceToCollision);
		if (!this.containsPoint(contactPoint)) {
			return;
		}

		const bounce = new Bounce(contactPoint, this.normal);
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
	}
}
class Mat3 {
	static I = new Mat3(Vec3.X, Vec3.Y, Vec3.Z);

	static createRotation2d(angle: number) {
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		return new Mat3(
			new Vec3(c, -s, 0),
			new Vec3(s, c, 0),
			Vec3.Z,
		);
	}
	static createTranslation2d(x: Vec2): Mat3;
	static createTranslation2d(x: number, y: number): Mat3;
	static createTranslation2d(x: any, y?: number): Mat3 {
		if (x instanceof Vec2) {
			y = x.y;
			x = x.x;
		}

		return new Mat3(
			new Vec3(1, 0, x),
			new Vec3(0, 1, notNull(y)),
			Vec3.Z,
		);
	}
	static fromEuler(p: Vec3): Mat3;
	static fromEuler(p: number, h: number, b: number): Mat3;

	static fromEuler(p: any, h?: any, b?: any): Mat3 {
		if (p instanceof Vec3) {
			b = p.z;
			h = p.y;
			p = p.x;
		}

		const	sinp = Math.sin(p);
		const	cosp = Math.cos(p);
		const	sinb = Math.sin(b);
		const	cosb = Math.cos(b);
		const	sinh = Math.sin(h);
		const	cosh = Math.cos(h);

		const sbsh = sinb * sinh;
		const cbch = cosb * cosh;
		const cbsh = cosb * sinh;
		const sbch = sinb * cosh;

		return new Mat3(
			new Vec3(cbch + sinp * sbsh, sinb * cosp, sinp * sbch - cbsh),
			new Vec3(sinp * cbsh - sbch, cosb * cosp, sbsh + sinp * cbch),
			new Vec3(sinh * cosp, -sinp, cosh * cosp),
		);
	}
	static createLook = (forward: Vec3, up?: Vec3, right?: Vec3) => {
		let x: Vec3, y: Vec3;
		const z: Vec3 = forward.unit();

		if (up) {
			y = up.unit();
			x = y.cross(z);
		} else {
			if (right) {
				x = right.unit();
			} else {
				x = new Vec3(z.z, 0, -z.x).unit();
			}
			y = z.cross(x);
		}
		return new Mat3(x, y, z);
	}
	static createRotation(angles: Vec3): Mat3 {
		const sinp = Math.sin(angles.x);
		const cosp = Math.cos(angles.x);
		const sinb = Math.sin(angles.z);
		const cosb = Math.cos(angles.z);
		const sinh = Math.sin(angles.y);
		const cosh = Math.cos(angles.y);

		const sbsh = sinb * sinh;
		const cbch = cosb * cosh;
		const cbsh = cosb * sinh;
		const sbch = sinb * cosh;

		return new Mat3(
			new Vec3(cbch + sinp * sbsh, sinb * cosp, sinp * sbch - cbsh),
			new Vec3(sinp * cbsh - sbch, cosb * cosp, sbsh + sinp * cbch),
			new Vec3(sinh * cosp, -sinp, cosh * cosp),
		);

	}

	_: Vec3[];
	private _flattened: number[];

	constructor(rows: Vec3[]);
	constructor(r0: Vec3, r1: Vec3, r2: Vec3);
	constructor(r0: any, r1?: Vec3, r2?: Vec3) {
		if (r0 instanceof Array) {
			if (r0.length !== 3) {
				throw new Error("wrong length: " + r0.length);
			}
			if (typeof r1 !== "undefined" || typeof r2 !== "undefined") {
				throw new Error("can't pass additional arguments here");
			}
			this._ = r0;
		} else {
			this._ = [r0, r1, r2];
		}

		// Object.freeze(this);
	}
	add(other: Mat3) {
		return new Mat3(
			this._[0].add(other._[0]),
			this._[1].add(other._[1]),
			this._[2].add(other._[2]),
		);
	}
	sub(other: Mat3) {
		return new Mat3(
			this._[0].sub(other._[0]),
			this._[1].sub(other._[1]),
			this._[2].sub(other._[2]),
		);
	}
	scale(value: number) {
		return new Mat3(
			this._[0].scale(value),
			this._[1].scale(value),
			this._[2].scale(value),
		);
	}
	multiply(other: Vec3): Vec3;
	multiply(other: Mat3): Mat3;

	multiply(other: any): any {
		if (other instanceof Vec3) {
			return this._[0].scale(other.x)
				.addScale(this._[1], other.y)
				.addScale(this._[2], other.z);
		}

		const rows: Vec3[] = [];

		for (let i = 0; i < 3; ++i) {
			const vx =
				this._[i].x * other._[0].x +
				this._[i].y * other._[1].x +
				this._[i].z * other._[2].x;

			const vy =
				this._[i].x * other._[0].y +
				this._[i].y * other._[1].y +
				this._[i].z * other._[2].y;

			const vz =
				this._[i].x * other._[0].z +
				this._[i].y * other._[1].z +
				this._[i].z * other._[2].z;

			rows.push(new Vec3(vx, vy, vz));
		}

		return new Mat3(rows);
	}
	transpose() {
		return new Mat3([
			new Vec3(this._[0].x, this._[1].x, this._[2].x),
			new Vec3(this._[0].y, this._[1].y, this._[2].y),
			new Vec3(this._[0].z, this._[1].z, this._[2].z),
		]);
	}
	rotate(v: Vec3) {
		return new Vec3(
			this._[0].dot(v),
			this._[1].dot(v),
			this._[2].dot(v),
		);
	}
	rotate2d(angle: number) {
		return Mat3.createRotation2d(angle).multiply(this);
	}
	translate2d(x: number, y: number) {
		return Mat3.createTranslation2d(x, y).multiply(this);
	}
	flatten() {
		let flattened = this._flattened;
		if (!flattened) {
			flattened = this._flattened = [];
			this._[0].pushTo(flattened);
			this._[1].pushTo(flattened);
			this._[2].pushTo(flattened);
		}
		return flattened;
	}

	toMat4(): Mat4 {
		return new Mat4([
			[this._[0].x, this._[0].y, this._[0].z, 0],
			[this._[1].x, this._[1].y, this._[1].z, 0],
			[this._[2].x, this._[2].y, this._[2].z, 0],
			[0, 0, 0, 1],
		]);
	}

}
class Mat4 {

	static I: Mat4 = new Mat4([
		[1, 0, 0, 0],
		[0, 1, 0, 0],
		[0, 0, 1, 0],
		[0, 0, 0, 1],
	]);

	static createPerspective(fovy: number, aspect: number, znear: number, zfar: number): Mat4 {
		const ymax = znear * Math.tan(fovy * Math.PI / 360.0);
		const ymin = -ymax;
		const xmin = ymin * aspect;
		const xmax = ymax * aspect;

		return Mat4.createFrustum(xmin, xmax, ymin, ymax, znear, zfar);
	}

	static createPerspective2(fovy: number, aspect: number, near: number, far: number): Mat4 {
		const out = new Float32Array(16);

		const f = 1.0 / Math.tan(fovy / 2);
		const nf = 1 / (near - far);

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

	static createLookAt(cameraPosition: Vec3, cameraTarget: Vec3, cameraUpVector: Vec3): Mat4 {
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
			[tx, ty, tz, 1],
		]);
	}

	static createTranslation(t: Vec3): Mat4 {
		return new Mat4([
			[1, 0, 0, t.x],
			[0, 1, 0, t.y],
			[0, 0, 1, t.z],
			[0, 0, 0, 1],
		]);
	}
	// from http://en.wikibooks.org/wiki/GLSL_Programming/Vertex_Transformations
	static createFrustum(l: number, r: number, b: number, t: number, n: number, f: number): Mat4 {
		const dx = r - l;
		const dy = t - b;
		const dz = f - n;

		const X = 2 * n / dx;
		const Y = 2 * n / dy;
		const A = (r + l) / dx;
		const B = (t + b) / dy;
		const C = -(f + n) / dz;
		const D = -2 * n * f / dz;

		return new Mat4([
			[X, 0, A, 0],
			[0, Y, B, 0],
			[0, 0, C, -D],
			[0, 0, 1, 0],
		]);
	}

	elements: Float32Array;

	constructor(rows: number[][] | Float32Array);
	constructor(arg: any) {
		if (arg[0].length) {
			this.elements = new Float32Array(16);
			for (let col = 4; col--;) {
				for (let row = 4; row--;) {
					this.elements[row + col * 4] = arg[row][col];
			}
				}
		} else {
			this.elements = arg;
		}
	}

	multiply(m: Mat4): Mat4 {
		const eltsL = this.elements;
		const eltsR = m.elements;

		const res = new Float32Array(16);

		for (let row = 4; row--;) {
			for (let col = 4; col--;) {
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

	getRow(row: number): number[] {
		return [
			this.elements[row + 0 * 4],
			this.elements[row + 1 * 4],
			this.elements[row + 2 * 4],
			this.elements[row + 3 * 4],
		];
	}

}
