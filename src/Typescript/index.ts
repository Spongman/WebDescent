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

declare class Stats {
	domElement: HTMLElement;

	begin(): void;
	end(): void;
	setMode(mode: number): void;
}
let _animationFunction: (time: number) => void;
let _focus = true;

let _pageX: number|null = null;
let _pageY: number|null = null;
let _timeLast: number|null = null;
let _iTriView = 0;
let _iTriViewLast = 0;
let _iStep = 0;
let _iStepLast = NaN;
let _stats: Stats;

interface Window {
	[index: string]: any;
}

if (!window.AudioContext) {
	window.AudioContext = window.webkitAudioContext;
}

interface Element {
	requestFullscreen(): void;
	requestPointerLock(): void;
}

$(document).ready(() => {
	if (AudioContext !== undefined) {
		_audio = new AudioContext();

		// no more doppler :(
		// const listener = _audio.listener;
		// listener.dopplerFactor = .15;

		const compressor = _audio.createDynamicsCompressor();
		compressor.connect(_audio.destination);
		_mainAudio = compressor;
	}

	function loadBuffer(name: string, pname: string) {
		const progr = $("#" + pname + " div");

		return $.ajax({
			url: name,
			type: "GET",
			xhrFields: {
				responseType: "arraybuffer",
			},
			dataType: "binary",
		}).progress((pct) => {
			progr.css({ width: pct + "%" });
		}).done((view) => {
			progr.css({ width: "100%", background: "green" });
		});
	}

	$.ajaxPrefilter((options, originalOptions, jqXHR) => {
		options.xhrFields = $.extend(options.xhrFields, {}, {
			onprogress(e: ProgressEvent) {
				if (e.lengthComputable) {
					const deferred: JQueryDeferred<number> = (jqXHR as any).deferred;
					if (deferred) {
						deferred.notify(Math.floor(e.loaded * 100 / e.total));
					}
				}
			},
		});
	});

	$.when(
		loadBuffer("assets/data/D2DEMO.PIG", "prog1"),
		loadBuffer("assets/data/D2DEMO.HOG", "prog2"),
		loadBuffer("assets/data/D2DEMO.HAM", "prog3"),
	).then((pigData: any[], hogData: any[], hamData: any[]) => {
		_ham = new Ham().load(hamData[0]);
		_pig = new Pig().load(pigData[0]);
		_hog = new Hog().load(hogData[0]);

	}).then(webGLStart).then(() => {
		if (window.location.host.indexOf("localhost") >= 0) {
			onDataLoaded();
		} else {
			_ham.playSound(114);

			$("#start")
				.attr("disabled", null)
				.text("Launch")
				.click(onDataLoaded);
		}
	});
});

function animate(time?: number) {
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

class Palette {
	colors: number[];

	load(view: DataView) {
		const stream = new DataStream(view);

		this.colors = stream.getRGBArray(256);

		return this;
	}
}
let _level: Level;

let _cubeDebug: Cube;
let _rgCubesDebug: Cube[];

let _rgVisibleCubesDebug: Cube[];
let _rgVisibleSidesDebug: Side[];
let _rgVisibleSidesBlendedDebug: Side[];

let _stackDebug: any[];
let _stepsDebug: any[];

function createProxy(obj: any, rgMaps: any[][]) {
	let unique = 1;
	const mapConverted: { [index: string]: any } = {};

	const result = convert(obj);

	// clean up
	for (const i in mapConverted) {
		if (!mapConverted.hasOwnProperty(i)) {
			continue;
		}
		const res = mapConverted[i];
		const src = res.__src;
		delete src.___;
		delete res.__src;
	}

	return result;

	function convert(obj: any) {
		if (typeof (obj) !== "object") {
			return obj;
		}

		let result = mapConverted[obj.___];
		if (result) {
			return result;
		}

		if (!obj.___) {
			obj.___ = unique++;
		}

		const cons = obj.constructor;

		if (cons === Array) {
			result = [];
			mapConverted[obj.___] = result;
			for (let i: number = obj.length; i--;) {
				result[i] = convert(obj[i]);
			}
		} else {
			for (let i: number = rgMaps.length; i--;) {
				const map = rgMaps[i];
				if (cons === map[0]) {
					const rgFields = map[1];

					result = {};
					mapConverted[obj.___] = result;
					for (let iField = rgFields.length; iField--;) {
						const fieldName = rgFields[iField];
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

	window.oncontextmenu = () => false;

	/*
	private _stats = new Stats();
	private _stats.setMode(0); // 0: fps, 1: ms
	private _stats.domElement.style.position = 'absolute';
	private _stats.domElement.style.left = '0px';
	private _stats.domElement.style.top = '0px';
	document.body.appendChild(_stats.domElement);
	*/

	$(window).focus(() => {
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

	}).blur(() => {
		if (_focus === false) {
			return;
		}
		_focus = false;
		// console.log("STOP animation");

	}).resize(() => {
		// console.log(canvas.clientWidth, canvas.clientHeight);
		updateViewport();
	});

	$(document).on("fullscreenchange", () => {
		document.body.requestPointerLock();

	}).mousedown((event) => {
		// return;
		if (typeof document.body.requestPointerLock !== "undefined") {
			document.body.requestPointerLock();
		}
		Keys.keyDown(-event.which);
		return false;

	}).mouseup((event) => {
		Keys.keyUp(-event.which);
		event.preventDefault();
		return false;

	}).mouseenter(() => {
		// console.log("MOUSEENTER");
		_pageX = _pageY = null;
	}).keydown((event: any) => {
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

	}).keyup((event: any) => {
		Keys.keyUp(event.keyCode);
	});

	$(document.body).on("mousemove", (event) => {
		const evt: any = event.originalEvent;
		if (typeof (evt.movementX) !== "undefined") {
			Keys._mouseDeltaX += evt.movementX;
			Keys._mouseDeltaY += evt.movementY;
		} else if (typeof (evt.webkitMovementX) !== "undefined") {
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

	const entryLevel1 = _hog.getEntry("d2leva-1.sl2");
	if (entryLevel1) {
		const level = _level = new Level(entryLevel1.view);

		const visibilityWorker = new Worker("./Visibility_worker.js");
		visibilityWorker.onmessage = (event) => {
			const data = event.data;
			if (data) {
				for (const key in data) {
					if (!data.hasOwnProperty(key)) {
						continue;
					}

					const value = data[key];
					switch (key) {
						case "setVisibility":
							const cube = level.cubes[value.iCube];

							cube.rgVisibleNeighbors = value.rgVisibleNeighbors.map((i: number) => level.cubes[i]);
							cube.rgLightingNeighbors = value.rgLightingNeighbors.map((i: number) => level.cubes[i]);
							cube.rgVisibleSides = value.rgVisibleSides.map((i: SideIndex) => level.getSideByIndex(i));
							cube.rgVisibleSidesBlended = value.rgVisibleSidesBlended.map((i: SideIndex) => level.getSideByIndex(i));
							cube.rgLightingSides = cube.rgVisibleSides.concat(cube.rgVisibleSidesBlended);

							break;
					}
				}
			}
		};
		const levelProxy = createProxy(
			level,
			[
				[Level, ["cubes"]],
				[Cube, ["rgSides", "index", "center", "_unique"]],
				[Side, ["vertices", "rgTriangles", "neighbor", "_unique", "tex1", "tex2"]],
				[Triangle, ["anchor", "normal"]],
				[Vec3, ["x", "y", "z"]],
			] as any[][],
		);

		visibilityWorker.postMessage({
			load: {
				level: levelProxy,
				LIGHT_DISTANCE_THRESHOLD,
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

		const entryPalette = _hog.getEntry(level.paletteName);
		if (!entryPalette) {
			throw new Error("palette " + level.paletteName + " not found");
		}
		const palette = new Palette().load(entryPalette.view);
		const palTex: WebGLTexture = initPalette(palette.colors);

		const bufferVertexPosition = gl.createBuffer();
		const bufferVertexTextureCoord = gl.createBuffer();
		const bufferVertexLight = gl.createBuffer();

		for (let iCube = level.cubes.length; iCube--;) {
			const cube = level.cubes[iCube];
			for (let iSide = 6; iSide--;) {
				const side = cube.rgSides[iSide];
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

		const timeStart = new Date().getTime() / 1000;

		const _iTriViewLast = -1;

		const rgCubes = level.cubes;
		const rgSides = Array.prototype.concat.apply([], level.cubes.map((c) => c.rgSides.filter((s) => !s.neighbor)));
		const rgSidesBlended = Array.prototype.concat.apply([], level.cubes.map((c) => c.rgSides.filter((s) => !!s.neighbor)));

		const viewer = level.rgObjects[0];

		viewer.controlType = ControlTypes.FLYING;
		viewer.movementType = MovementTypes.PHYSICS;
		viewer.controls = Keys;

		const flash = viewer.cube.createExplosion(0, viewer.pos.addScale(viewer.orient._[2], viewer.size * 0.8), viewer.size, KnownVClips.PLAYER_APPEARANCE);
		flash.orient = viewer.orient;
		_ham.playSound(_ham.rgVClips[KnownVClips.PLAYER_APPEARANCE].sound_num);

		const iWeapon = 0;
		let timeFire = 0;

		let cubeLast: Cube;

		const drawAnimationFrame = (time: number) => {
			function fetchVisibility(cube: Cube) {
				if (cube && !cube.rgVisibleNeighbors) {
					cube.rgVisibleNeighbors = [];
					visibilityWorker.postMessage({ getVisibility: cube.index });
				}
			}

			function renderPath(rgNodes: CubePos[]) {
				if (!rgNodes || rgNodes.length < 2) {
					return;
				}

				const rgVertices: number[] = [];
				const rgColors: number[] = [];
				for (const node of rgNodes) {
					node.pos.pushTo(rgVertices);
					Vec3.One.pushTo(rgColors);
				}

				const bufferVertices = createBuffer(rgVertices, 3);
				const bufferColors = createBuffer(rgColors, 3);

				useProgram(programFlat);
				gl.uniform3f(programFlat.light, 1, 1, 1);
				loadAttribBuffer(programFlat.aVertexPosition, bufferVertices);
				loadAttribBuffer(programFlat.aVertexColor, bufferColors);
				gl.drawArrays(gl.LINE_STRIP, 0, rgNodes.length);
				gl.deleteBuffer(bufferVertices);
				gl.deleteBuffer(bufferColors);
			}

			const timeLast = _timeLast;
			_timeLast = time;

			const frameTime = (time - _timeLast);
			if (!frameTime) {
				return;
			}

			Keys.updateControls(frameTime);

			// do effects

			_ham.updateEffects(frameTime);

			ExplodingWall.update(time);
			CloakingWall.update(frameTime);

			level.update(time, frameTime);

			if (Keys.firePrimary) {
				if (time > timeFire) {
					const weapon = _ham.rgWeaponInfos[_player.primary_weapon];
					timeFire = time + weapon.fire_wait;

					viewer.fireLaser(iWeapon, _player.laser_level, 0, !!(_player.flags & PlayerFlags.QUAD_LASERS));
				}
			}

			const pos = viewer.pos;
			const orient = viewer.orient;

			beginScene(pos, orient);

			if (_audio) {
				PlayingSound.update();

				const listener = _audio.listener;
				const vel = (viewer.mover as PhysicsInfo).velocity;

				const lookAt = matModelView.getRow(2);
				const lookUp = matModelView.getRow(1);

				listener.setOrientation(
					-lookAt[0], -lookAt[1], -lookAt[2],
					lookUp[0], lookUp[1], -lookUp[2],
				);

				listener.setPosition(pos.x + lookUp[0] / 100, pos.y + lookUp[1] / 100, pos.z - lookUp[2] / 100);
				// no more doppler :(
				// listener.setVelocity(vel.x, vel.y, vel.z);
			}

			bindTexture(0, palTex);

			gl.enable(gl.DEPTH_TEST);

			// gl.enable(gl.BLEND);
			gl.disable(gl.BLEND);
			gl.disable(gl.DEPTH_TEST);

			let cubeInside: Cube|null = viewer.cube;

			if (cubeInside) {
				if (!cubeInside.isPointInside(pos)) {
					// console.log("OUTSIDE");
					cubeInside = null;
				}
			}

			if (!cubeInside) {
				for (let iCube = rgCubes.length; iCube--;) {
					const cube = rgCubes[iCube];
					if (cube.isPointInside(pos)) {
						cubeInside = cube;
						break;
					}
				}
			}

			let rgVisibleCubes: Cube[];
			let rgVisibleSides: Side[];
			let rgVisibleSidesBlended: Side[];

			if (cubeInside) {
				if (cubeLast !== cubeInside) {
					cubeLast = cubeInside;

					fetchVisibility(cubeInside);

					for (let iSide = 6; iSide--;) {
						const side = cubeInside.rgSides[iSide];
						if (side) {
							fetchVisibility(side.neighbor);
						}
					}
				}

				rgVisibleCubes = cubeInside.rgVisibleNeighbors || [];
				rgVisibleSides = cubeInside.rgVisibleSides || [];
				rgVisibleSidesBlended = cubeInside.rgVisibleSidesBlended || [];
			} else {
				rgVisibleCubes = rgCubes;
				rgVisibleSides = rgSides;
				rgVisibleSidesBlended = rgSidesBlended;
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
				const lightingDistance2 = LIGHT_DISTANCE_THRESHOLD * LIGHT_DISTANCE_THRESHOLD;

				const center = cubeLast.center;

				const rgLightingSides = cubeLast.rgLightingSides;
				if (rgLightingSides) {
					const mapObjectLights: { [index: string]: Vec3|null } = {};

					for (let i = rgLightingSides.length; i--;) {
						const side = rgLightingSides[i];
						const rgVertices = side.vertices;
						const rgVertexLight = side.rgVertexLight;

						rgVertexLight[0] = null;
						rgVertexLight[1] = null;
						rgVertexLight[2] = null;
						rgVertexLight[3] = null;
						side.updateLight = true;

						const rgLightingCubes = side.rgLightingCubes;
						for (let iCube = rgLightingCubes.length; iCube--;) {
							const cube = rgLightingCubes[iCube];
							const rgObjects = cube._rgObjects;
							for (let iObject = rgObjects.length; iObject--;) {
								const object: Item = rgObjects[iObject];
								let objectLight = mapObjectLights[object._unique];
								if (!objectLight) {
									objectLight = mapObjectLights[object._unique] = object.getEmittedLight(time);
								}

								if (objectLight) {
									const pos = object.pos;

									for (let iVertex = 4; iVertex--;) {
										const vertex = rgVertices[iVertex];
										const dist2 = vertex.distanceTo2(pos);
										if (dist2 <= lightingDistance2) {
											const dist = dist2 < 16 ? 16 : Math.sqrt(dist2);

											let light = rgVertexLight[iVertex];
											if (light) {
												light = light.addScale(objectLight, 1 / dist);
											} else {
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

			function Math_sqrt(x: number) { return Math.sqrt(x); }

			// updateLighting();
			const fWireframe = Keys.wireframe;

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

				loadAttribBuffer(programSingle.aVertexPosition, level.bufferVertexPosition);
				loadAttribBuffer(programSingle.aVertexTextureCoord, level.bufferVertexTextureCoord);
				loadAttribBuffer(programSingle.aVertexLight, level.bufferVertexLight);
				loadAttribBuffer(programSingle.aVertexBrightness, level.bufferVertexTextureBrightness);

				for (const side of rgVisibleSides) {
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

				loadAttribBuffer(programDouble.aVertexPosition, level.bufferVertexPosition);
				loadAttribBuffer(programDouble.aVertexTextureCoord, level.bufferVertexTextureCoord);
				loadAttribBuffer(programDouble.aVertexLight, level.bufferVertexLight);
				loadAttribBuffer(programDouble.aVertexBrightness, level.bufferVertexTextureBrightness);

				for (let iSide = rgVisibleSides.length; iSide--;) {
					const side = rgVisibleSides[iSide];
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
				for (let iCube = rgVisibleCubes.length; iCube--;) {
					const cube = rgVisibleCubes[iCube];
					cube.renderObjects(time);
				}
			}

			if (true) {
				useProgram(programSingle);

				loadAttribBuffer(programSingle.aVertexPosition, level.bufferVertexPosition);
				loadAttribBuffer(programSingle.aVertexTextureCoord, level.bufferVertexTextureCoord);
				loadAttribBuffer(programSingle.aVertexLight, level.bufferVertexLight);
				loadAttribBuffer(programSingle.aVertexBrightness, level.bufferVertexTextureBrightness);

				for (let iSide = rgVisibleSidesBlended.length; iSide--;) {
					const side = rgVisibleSidesBlended[iSide];
					if (side.program === programSingle) {
						side.render(time, fWireframe);
					}
				}

				useProgram(programDouble);

				loadAttribBuffer(programDouble.aVertexPosition, level.bufferVertexPosition);
				loadAttribBuffer(programDouble.aVertexTextureCoord, level.bufferVertexTextureCoord);
				loadAttribBuffer(programDouble.aVertexLight, level.bufferVertexLight);
				loadAttribBuffer(programDouble.aVertexBrightness, level.bufferVertexTextureBrightness);

				for (let iSide = rgVisibleSidesBlended.length; iSide--;) {
					const side = rgVisibleSidesBlended[iSide];
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
