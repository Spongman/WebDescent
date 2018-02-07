/// <reference path="Math.ts" />

//// <reference path="jquery.d.ts" />
"use strict";

declare class WebGLDebugUtils {
	static makeDebugContext(gl: WebGLRenderingContext): WebGLRenderingContext;
}

interface WebGLObject {
	[index: string]: any;
}

let gl: WebGLRenderingContext;

interface JQuery {
	each(func: (index: number, elem: any) => any): JQuery;
}

function createProgram(name: string, attrs: string[], uniforms: string[]) {
	function compileShader(shaderType: number, str: string) {
		const shader = gl.createShader(shaderType);
		gl.shaderSource(shader, str);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const error = gl.getShaderInfoLog(shader);
			throw new Error(`Error compiling ${shaderType}:\n${error}`);
		}

		return shader;
	}

	return $.when(
		$.get(`assets/shaders/${name}.vs.glsl`),
		$.get(`assets/shaders/${name}.fs.glsl`),
	).then((vsArgs: any[], fsArgs: any[]) => {
		const program = notNull(gl.createProgram());
		gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsArgs[0] + "\n//" + name + ".vs"));
		gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsArgs[0] + "\n//" + name + ".fs"));
		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			alert("LINK: Could not initialise shaders");
		}

		useProgram(program);

		$.each(attrs, (i: number, e: string): void => {
			const loc = gl.getAttribLocation(program, e);
			if (!(loc >= 0)) {
				throw new Error(`${name}: attribute '${e}' not found!`);
			}
			program[e] = loc;
			// console.log(vs + " ATTR " + e + " = " + loc);
			// gl.enableVertexAttribArray(loc);
		});

		$.each(uniforms, (i: number, e: string): void => {
			const loc = gl.getUniformLocation(program, e);
			if (!loc) {
				throw new Error(`${name}: uniform '${e}' not found!`);
			}
			program[e] = loc;
		});

		return program;
	});
}

let programDouble: WebGLProgram;
let programSingle: WebGLProgram;
let programFlat: WebGLProgram;
let programBillboard: WebGLProgram;
let programBillboardX: WebGLProgram;
let programLit: WebGLProgram;

let rgPrograms: WebGLProgram[];

interface JQuery {
	map(callback: (index: number, domElement: any) => any): any[];
}

function initShaders() {
	const rgBillboardVertexPositions = [
		new Vec2(0, 0),
		new Vec2(0, 1),
		new Vec2(1, 1),
		new Vec2(1, 0),
	];

	return $.when(
		createProgram(
			"double",
			[
				"aVertexPosition",
				"aVertexTextureCoord",
				"aVertexLight",
				"aVertexBrightness",
			],
			[
				"matProjection",
				"matModelView",
				"slide",
				"alpha",
				"sampPalette",

				"matOrientTex2",
				"sampTexture1",
				"sampTexture2",
				// "sampVertexPositions",
				// "matTriView",
				// "xMin", "xMax", "yMin", "yMax",
			],
		).done((program: WebGLProgram) => {
			programDouble = program;
			gl.uniform1i(programDouble.sampPalette, 0);
			gl.uniform1i(programDouble.sampTexture1, 1);
			gl.uniform1i(programDouble.sampTexture2, 2);
			gl.uniform1f(programDouble.alpha, 1.0);
		}),

		createProgram(
			"single",
			[
				"aVertexPosition",
				"aVertexTextureCoord",
				"aVertexLight",
				"aVertexBrightness",
			],
			[
				"matProjection",
				"matModelView",
				"sampPalette",
				"slide",
				"alpha",

				"sampTexture",
				/*
				"leftPlaneAnchor", "leftPlaneNormal",
				"rightPlaneAnchor", "rightPlaneNormal",
				"bottomPlaneAnchor", "bottomPlaneNormal",
				"topPlaneAnchor", "topPlaneNormal",
				*/
			],
		).done((program: WebGLProgram) => {
			programSingle = program;
			gl.uniform1i(programSingle.sampPalette, 0);
			gl.uniform1i(programSingle.sampTexture, 1);
			gl.uniform1f(programSingle.alpha, 1.0);
		}),

		createProgram(
			"lit",
			[
				"aVertexPosition",
				"aVertexTextureCoord",
			],
			[
				"matProjection",
				"matModelView",
				"sampTexture",
				"sampPalette",
				"light",
			],
		).done((program: WebGLProgram) => {
			programLit = program;
			gl.uniform1i(programLit.sampPalette, 0);
			gl.uniform1i(programLit.sampTexture, 1);
		}),

		createProgram(
			"flat",
			[
				"aVertexPosition",
				"aVertexColor",
			],
			[
				"matProjection",
				"matModelView",
				"light",
			],
		).done((program: WebGLProgram) => {
			programFlat = program;
		}),

		createProgram(
			"billboard",
			[
				"aVertexPosition",
			],
			[
				"matProjection",
				"matModelView",
				"sampTexture",
				"sampPalette",
				"sizeTexture",
				"scale",
				// "alpha",
				"pos",
			],
		).done((program: WebGLProgram) => {
			programBillboard = program;
			gl.uniform1i(programBillboard.sampPalette, 0);
			gl.uniform1i(programBillboard.sampTexture, 1);

			programBillboard.bufferVertexPosition = createBuffer(Array.prototype.concat.apply([], rgBillboardVertexPositions.map((v) => v.flatten())), 2);
			loadAttribBuffer(programBillboard.aVertexPosition, programBillboard.bufferVertexPosition);
		}),

		createProgram(
			"billboard-x",
			[
				"aVertexPosition",
			],
			[
				"matProjection",
				"matModelView",
				"sampTexture",
				"sampPalette",
				"sizeTexture",
				"scale",
				// "alpha",
				"pos",
				"eye",
			],
		).done((program: WebGLProgram) => {
			programBillboardX = program;
			gl.uniform1i(programBillboardX.sampPalette, 0);
			gl.uniform1i(programBillboardX.sampTexture, 1);

			programBillboardX.bufferVertexPosition = createBuffer(Array.prototype.concat.apply([], rgBillboardVertexPositions.map((v) => v.flatten())), 2);
			loadAttribBuffer(programBillboardX.aVertexPosition, programBillboardX.bufferVertexPosition);
		}),
	).done(function() {
		rgPrograms = $.makeArray(arguments);
	});
}

const _rgTextures = new Array<WebGLTexture>(5);

let _activeTexture: number | null;
function bindTexture(iUnit: number, tex: WebGLTexture) {
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
function createTexture(iUnit: number, filter?: number) {
	const texImage = gl.createTexture();
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

function initPalette(rgColors: number[]) {
	const tex = createTexture(0);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	updatePalette(tex, rgColors);
	return tex;
}

function updatePalette(tex: WebGLTexture, rgColors: number[]) {
	// WebGL needs an unpacked array of RGB values
	const rgb = new Uint8Array(256 * 4);
	let ib = 0;
	for (let i = 0; i < 256; ++i) {
		const color = rgColors[i];
		rgb[ib++] = 4 * (color >> 16) & 0xff;	// R
		rgb[ib++] = 4 * (color >> 8) & 0xff;	// G
		rgb[ib++] = 4 * (color >> 0) & 0xff;	// B
		rgb[ib++] = (i >= 254) ? 0 : 255;		// A
	}

	// update the palette
	bindTexture(0, tex);
	gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgb);
	// gl.bindTexture(gl.TEXTURE_2D, null);
}

function createBuffer(rgItems: number[], cValuesPerItem: number, flags?: number) {
	if (!rgItems) {
		throw new Error("invalid item array");
	}

	const cItems = rgItems.length;
	if (!cItems || (cItems % cValuesPerItem) !== 0) {
		throw new Error("invalid #items");
	}

	if (flags == null) {
		flags = gl.STATIC_DRAW;
	}

	const items = new Float32Array(rgItems);
	const buffer = gl.createBuffer();
	if (!buffer) {
		throw new Error("failed to create buffer");
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, items, flags);
	buffer.itemSize = cValuesPerItem;
	buffer.numItems = cItems / cValuesPerItem;
	return buffer;
}

function createDynamicBuffer(rgItems: number[], cValuesPerItem: number) {
	if (!rgItems) {
		throw new Error("invalid item array");
	}

	const cItems = rgItems.length;
	if (!cItems || (cItems % cValuesPerItem) !== 0) {
		throw new Error("invalid #items");
	}

	const items = new Float32Array(rgItems);
	const buffer = gl.createBuffer();
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

function updateDynamicBuffer(buffer: WebGLBuffer, offset: number, items: Float32Array) {
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

let _cHits = 0;
let _cCalls = 0;
const _mapAttribBuffers: WebGLBuffer[] = [];
function loadAttribBuffer(attrib: number, buffer: WebGLBuffer) {
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

	const canvas = gl.canvas;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;

	canvas.width = 800;
	canvas.height = 600;

	canvas.width = width;
	canvas.height = height;

	gl.viewport(0, 0, canvas.width, canvas.height);

	const FOV = 59;
	const matProjection = Mat4.createPerspective(FOV, width / height, .01, 5000).flatten();

	for (let i = rgPrograms.length; i--;) {
		const program = rgPrograms[i];
		gl.useProgram(program);
		gl.uniformMatrix4fv(program.matProjection, false, matProjection);
	}

	_programLast = rgPrograms[0];
}

let matModelView: Mat4;
const rgMatrices: Mat4[] = [];

function beginScene(position: Vec3, orient: Mat3) {
	const or4 = orient.toMat4();

	matModelView = or4.multiply(Mat4.createTranslation(Vec3.Zero.sub(position)));
	rgMatrices.length = 0;

	// updateMatModelView(matModelView);

	useProgram(programBillboardX);
	gl.uniform3f(programBillboardX.eye, position.x, position.y, position.z);

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function createAngleMatrix(angles: Vec3 | null, pos: Vec3 | null) {
	let mat: Mat4 | null = pos ? Mat4.createTranslation(pos) : null;

	if (angles && angles !== Vec3.Zero) {
		const matOrient = Mat3.createRotation(angles).toMat4();
		if (mat) {
			mat = mat.multiply(matOrient);
		} else {
			mat = matOrient;
		}
	}

	return mat;
}

function pushInstanceMatrix(m: Mat4) {
	if (!(m instanceof Mat4)) {
		throw new Error("invalid argument: m");
	}
	pushMatrix(matModelView.multiply(m));
}

function pushMatrix(m: Mat4) {
	if (!(m instanceof Mat4)) {
		throw new Error("invalid argument: m");
	}

	rgMatrices.push(matModelView);
	updateMatModelView(m);
}

function pushAnglesMatrix(angles: Vec3, pos?: Vec3) {
	if (!(angles instanceof Vec3)) {
		throw new Error("invalid argument: angles");
	}

	const matOrient = Mat3.fromEuler(angles.x, angles.y, angles.z);
	pushOrientMatrix(matOrient, pos);
}

function pushTranslateMatrix(pos: Vec3) {
	if (!(pos instanceof Vec3)) {
		throw new Error("invalid argument: pos");
	}

	const matPos = Mat4.createTranslation(pos);
	pushInstanceMatrix(matPos);
}

function pushOrientMatrix(matOrient: Mat3, pos?: Vec3) {
	if (!(matOrient instanceof Mat3)) {
		throw new Error("invalid argument: matOrient");
	}

	let mat = matOrient.transpose().toMat4();

	if (pos) {
		if (!(pos instanceof Vec3)) {
			throw new Error("invalid vector: pos");
		}
		const matPos = Mat4.createTranslation(pos);
		mat = matPos.multiply(mat);
	}

	pushInstanceMatrix(mat);
}

function popMatrix() {
	updateMatModelView(matModelView = notNull(rgMatrices.pop()));
	return matModelView;
}

let _programLast: WebGLProgram;
function useProgram(program: WebGLProgram) {
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

function updateMatModelView(m: Mat4) {
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
	const canvas = $("#canvas")[0] as HTMLCanvasElement;
	gl = canvas.getContext("experimental-webgl") as WebGLRenderingContext;

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
