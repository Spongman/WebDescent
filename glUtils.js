/// <areference path="sylvester.src.js" />
/// <areference path="DataView.js" />

// augment Sylvester some
Matrix.Translation = function (v)
{
	var r, elts = v.elements || v;
	if (elts.length === 2)
	{
		r = Matrix.I(3);
		r.elements[2][0] = elts[0];
		r.elements[2][1] = elts[1];
		return r;
	}

	if (elts.length === 3)
	{
		r = Matrix.I(4);
		r.elements[0][3] = elts[0];
		r.elements[1][3] = elts[1];
		r.elements[2][3] = elts[2];
		return r;
	}

	throw "Invalid length for Translation";
};


Matrix.createRotation = function (p, h, b)
{
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

	return $M([
		[cbch + sinp * sbsh, sinb * cosp, sinp * sbch - cbsh],
		[sinp * cbsh - sbch, cosb * cosp, sbsh + sinp * cbch],
		[sinh * cosp, -sinp, cosh * cosp],
	]);
};


Matrix.prototype.flatten = function ()
{
	if (this.elements.length === 0)
		return [];

	var result = [];
	for (var j = 0; j < this.elements[0].length; j++)
		for (var i = 0; i < this.elements.length; i++)
			result.push(this.elements[i][j]);
	return result;
};

Matrix.prototype.ensure4x4 = function ()
{
	if (this.elements.length === 4 &&
        this.elements[0].length === 4)
		return this;

	if (this.elements.length > 4 ||
        this.elements[0].length > 4)
		return null;

	for (var i = 0; i < this.elements.length; i++)
	{
		for (var j = this.elements[i].length; j < 4; j++)
		{
			if (i === j)
				this.elements[i].push(1);
			else
				this.elements[i].push(0);
		}
	}

	for (var i = this.elements.length; i < 4; i++)
	{
		var row = [0, 0, 0, 0];
		row[i] = 1;
		this.elements.push(row);
	}

	return this;
};

Matrix.prototype.make3x3 = function ()
{
	if (this.elements.length !== 4 ||
        this.elements[0].length !== 4)
		return null;

	return Matrix.create([[this.elements[0][0], this.elements[0][1], this.elements[0][2]],
                          [this.elements[1][0], this.elements[1][1], this.elements[1][2]],
                          [this.elements[2][0], this.elements[2][1], this.elements[2][2]]]);
};

Vector.prototype.flatten = function ()
{
	return this.elements;
};

function mht(m)
{
	var s = "";
	if (m.length === 16)
	{
		for (var i = 0; i < 4; i++)
		{
			s += "<span style='font-family: monospace'>[" + m[i * 4 + 0].toFixed(4) + "," + m[i * 4 + 1].toFixed(4) + "," + m[i * 4 + 2].toFixed(4) + "," + m[i * 4 + 3].toFixed(4) + "]</span><br>";
		}
	}
	else if (m.length === 9)
	{
		for (var i = 0; i < 3; i++)
		{
			s += "<span style='font-family: monospace'>[" + m[i * 3 + 0].toFixed(4) + "," + m[i * 3 + 1].toFixed(4) + "," + m[i * 3 + 2].toFixed(4) + "]</span><br>";
		}
	}
	else
	{
		return m.toString();
	}
	return s;
}

//
// gluLookAt
//
function makeLookAt(ex, ey, ez,
                    cx, cy, cz,
                    ux, uy, uz)
{
	var eye = $V([ex, ey, ez]);
	var center = $V([cx, cy, cz]);
	var up = $V([ux, uy, uz]);

	var mag;

	var z = center.subtract(eye).toUnitVector();
	var x = up.cross(z).toUnitVector();
	var y = z.cross(x);//.toUnitVector();

	var m = $M([[x.e(1), x.e(2), x.e(3), 0],
                [y.e(1), y.e(2), y.e(3), 0],
                [z.e(1), z.e(2), z.e(3), 0],
                [0, 0, 0, 1]]);

	var t = $M([[1, 0, 0, -ex],
                [0, 1, 0, -ey],
                [0, 0, 1, -ez],
                [0, 0, 0, 1]]);
	return m.x(t);
}

//
// glOrtho
//
function makeOrtho(left, right,
                   bottom, top,
                   znear, zfar)
{
	var dx = right - left;
	var dy = top - bottom;
	var dz = zfar - znear;

	var tx = -(right + left) / dx;
	var ty = -(top + bottom) / dy;
	var tz = -(zfar + znear) / dz;

	return $M([[2 / dx, 0, 0, tx],
               [0, 2 / dy, 0, ty],
               [0, 0, -2 / dz, tz],
               [0, 0, 0, 1]]);
}


//
// gluPerspective
//
function makePerspective(fovy, aspect, znear, zfar)
{
	var ymax = znear * Math.tan(fovy * Math.PI / 360.0);
	var ymin = -ymax;
	var xmin = ymin * aspect;
	var xmax = ymax * aspect;

	return makeFrustum(xmin, xmax, ymin, ymax, znear, zfar);
}

// from http://en.wikibooks.org/wiki/GLSL_Programming/Vertex_Transformations
function makeFrustum(l, r, b, t, n, f)
{
	var dx = r - l;
	var dy = t - b;
	var dz = n - f;

	var X = 2 * n / dx;
	var Y = 2 * n / dy;
	var A = (r + l) / dx;
	var B = (t + b) / dy;
	var C = (n + f) / dz;
	var D = 2 * n * f / dz;

	return $M([[X, 0, A, 0],
               [0, Y, B, 0],
               [0, 0, C, -D],
               [0, 0, 1, 0]]);
}


Line.fromEnds = function (p1, p2)
{
	var L = new Line();
	return L.setVectors(p1, p2.subtract(p1));
};


Plane.fromPoints = function (p1, p2, p3)
{
	var P = new Plane();
	return P.setVectors(p1, p2.subtract(p1), p3.subtract(p1));
};

