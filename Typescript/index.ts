/// <reference path="../Scripts/typings/jquery/jquery.d.ts" />
/// <reference path="DataView.ts" />
/// <reference path="DataStream.ts" />

/// <reference path="webgl.ts" />

/// <reference path="Math.ts" />
/// <reference path="Object.ts" />
/// <reference path="Player.ts" />

/// <reference path="Ham.ts" />
/// <reference path="Pig.ts" />
/// <reference path="Hog.ts" />

/// <reference path="Level.ts" />

declare class Stats
{
	begin(): void;
	end(): void;
	domElement: HTMLElement;
	setMode(mode: number): void;
}
var _animationFunction: (time: Number) => void;
var _focus = true;

var _pageX: number, _pageY: number;
var _timeLast: number;
var _iTriView = 0;
var _iTriViewLast = 0;
var _iStep = 0;
var _iStepLast = NaN;
var _stats: Stats;

if (!window['AudioContext'])
	window['AudioContext'] = window['webkitAudioContext'];

interface Element
{
	requestFullscreen(): void;
	requestPointerLock(): void;
}

$(document).ready(function ()
{
	if (AudioContext !== undefined)
	{
		_audio = new AudioContext();

		// no more doppler :(
		//var listener = _audio.listener;
		//listener.dopplerFactor = .15;

		var compressor = _audio.createDynamicsCompressor();
		compressor.connect(_audio.destination);
		_mainAudio = compressor;
	}

	function loadBuffer(name: string, pname: string)
	{
		var progr = $("#" + pname + " div");

		return $.ajax({
			url: name,
			type: 'GET',
			xhrFields: {
				"responseType": 'arraybuffer'
			},
			dataType: 'binary'
		}).progress(pct =>
		{
			progr.css({ width: pct + "%" });
		}).done((view) =>
		{
			progr.css({ width: "100%", background: "green" });
		});
	}

	$.when(
		loadBuffer("D2DEMO.PIG", "prog1"),
		loadBuffer("D2DEMO.HOG", "prog2"),
		loadBuffer("D2DEMO.HAM", "prog3")
	).then((pigData: any[], hogData: any[], hamData: any[]) =>
	{
		_ham = new Ham().load(hamData[0]);
		_pig = new Pig().load(pigData[0]);
		_hog = new Hog().load(hogData[0]);

		$("#canvas").show();
		$("#loader").hide();

	}).then(webGLStart).then(() =>
	{
		function start()
		{
			onDataLoaded();
		}

		$("#start")
			.attr('disabled', null)
			.text('Launch')
			.click(start);

		start();
	});
});

function animate(time?: number)
{
	if (!_animationFunction || !_focus)
		return;

	requestAnimationFrame(animate);

	if (time)
	{
		if (_stats)
			_stats.begin();
		_animationFunction(time / 1000);
		if (_stats)
			_stats.end();
	}
}

class Palette
{
	colors: number[];

	load(view: DataView)
	{
		var stream = new DataStream(view);

		this.colors = stream.getRGBArray(256);

		return this;
	}
}
var _level: Level;

var _cubeDebug: Cube, _rgCubesDebug: Cube[];

var _rgVisibleCubesDebug: Cube[];
var _rgVisibleSidesDebug: Side[];
var _rgVisibleSidesBlendedDebug: Side[];

var _stackDebug: any[];
var _stepsDebug: any[];

function createProxy(obj: any, rgMaps: any[][])
{
	var unique = 1;
	var mapConverted: { [index: string]: any } = {};

	var result = convert(obj);

	// clean up
	for (var i in mapConverted)
	{
		var res = mapConverted[i];
		var src = res.__src;
		delete src.___;
		delete res.__src;
	}

	return result;

	function convert(obj: any)
	{
		if (typeof (obj) !== "object")
			return obj;

		var result = mapConverted[obj.___];
		if (result)
			return result;

		if (!obj.___)
			obj.___ = unique++;

		var cons = obj.constructor;

		if (cons === Array)
		{
			result = [];
			mapConverted[obj.___] = result;
			for (var i: number = obj.length; i--;)
				result[i] = convert(obj[i]);
		}
		else
		{
			for (var i: number = rgMaps.length; i--;)
			{
				var map = rgMaps[i];
				if (cons === map[0])
				{
					var rgFields = map[1];

					result = {};
					mapConverted[obj.___] = result;
					for (var iField = rgFields.length; iField--;)
					{
						var fieldName = rgFields[iField];
						result[fieldName] = convert(obj[fieldName]);
					}
					break;
				}
			}

			if (!result)
			{
				throw new Error("unmarshallable constructor: " + obj);
			}
		}

		result.__src = obj;

		return result;
	}
}

function onDataLoaded()
{
	window.oncontextmenu = function () { return false; };

	/*
	_stats = new Stats();
	_stats.setMode(0); // 0: fps, 1: ms
	_stats.domElement.style.position = 'absolute';
	_stats.domElement.style.left = '0px';
	_stats.domElement.style.top = '0px';
	document.body.appendChild(_stats.domElement);
	*/

	$(window).focus(function ()
	{
		if (_focus === true)
			return;
		_focus = true;

		_pageX = _pageY = _timeLast = undefined;

		Keys.reset();

		//console.log("START animation");

		if (_animationFunction)
			animate();

	}).blur(function ()
	{
		if (_focus === false)
			return;
		_focus = false;
		//console.log("STOP animation");

	}).resize(function ()
	{
		//console.log(canvas.clientWidth, canvas.clientHeight);
		updateViewport();
	});

	$(document).on("fullscreenchange", function ()
	{
		document.body.requestPointerLock();

	}).mousedown(function (event)
	{
		//return;
		if (typeof document.body.requestPointerLock !== 'undefined')
			document.body.requestPointerLock();
		Keys.keyDown(-event.which);
		return false;

	}).mouseup(function (event)
	{
		Keys.keyUp(-event.which);
		event.preventDefault();
		return false;

	}).mouseenter(function ()
	{
		//console.log("MOUSEENTER");
		_pageX = _pageY = undefined;
	}).keydown(function (event: any)
	{
		if (Keys.keyDown(event.keyCode))
			event.preventDefault();

		switch (event.keyCode)
		{
			case 13:
				if (event.altKey)
				{
					document.body.requestFullscreen();
				}
				break;
		}

	}).keyup(function (event: any)
	{
		Keys.keyUp(event.keyCode);
	});


	$(document.body).on("mousemove", function (event)
	{
		var evt: any = event.originalEvent;
		if (typeof (evt.movementX) !== "undefined")
		{
			Keys._mouseDeltaX += evt.movementX;
			Keys._mouseDeltaY += evt.movementY;
		}
		else if (typeof (evt.webkitMovementX) !== "undefined")
		{
			Keys._mouseDeltaX += evt.webkitMovementX;
			Keys._mouseDeltaY += evt.webkitMovementY;
		}

		if (!isNaN(_pageX))
			Keys._mouseDeltaX += event.pageX - _pageX;

		if (!isNaN(_pageY))
			Keys._mouseDeltaY += event.pageY - _pageY;

		_pageX = event.pageX;
		_pageY = event.pageY;
	});



	var entryLevel1 = _hog.getEntry("d2leva-1.sl2");
	if (entryLevel1)
	{
		var level = _level = new Level(entryLevel1.view);

		var visibilityWorker = new Worker("./Compiled/Visibility_worker.js");
		visibilityWorker.onmessage = function (event)
		{
			var data = event.data;
			if (data)
			{
				for (var key in data)
				{
					var value = data[key];
					switch (key)
					{
						case "setVisibility":
							var cube = level.cubes[value.iCube];

							cube.rgVisibleNeighbors = value.rgVisibleNeighbors.map(function (i: number) { return level.cubes[i]; });
							cube.rgLightingNeighbors = value.rgLightingNeighbors.map(function (i: number) { return level.cubes[i]; });
							cube.rgVisibleSides = value.rgVisibleSides.map(function (i: SideIndex) { return level.getSideByIndex(i); });
							cube.rgVisibleSidesBlended = value.rgVisibleSidesBlended.map(function (i: SideIndex) { return level.getSideByIndex(i); });
							cube.rgLightingSides = cube.rgVisibleSides.concat(cube.rgVisibleSidesBlended);

							break;
					}
				}
			}
		}
		var levelProxy = createProxy(
			level,
			<any[][]>[
				[Level, ["cubes"]],
				[Cube, ["rgSides", "index", "center", "_unique"]],
				[Side, ["vertices", "rgTriangles", "neighbor", "_unique", "tex1", "tex2"]],
				[Triangle, ["anchor", "normal"]],
				[Vec3, ["x", "y", "z"]],
			]
		);

		visibilityWorker.postMessage({
			load: {
				level: levelProxy,
				LIGHT_DISTANCE_THRESHOLD: LIGHT_DISTANCE_THRESHOLD,
			}
		});

		/*
		if (false)
		{
			if (console.profile)
				console.profile();
			var startTime = new Date().getTime();

			//for (var iCube = 0; iCube < Math.min (100, level.cubes.length); ++iCube)
			for (var iCube = level.cubes.length; iCube--;)
			{
				var cube = level.cubes[iCube];
				if (cube.index >= 0)
					cube.getVisibleNeighbors();
			}

			if (console.profileEnd)
				console.profileEnd();
			console.log((new Date().getTime() - startTime) / 1000);
		}
		*/

		var entryPalette = _hog.getEntry(level.paletteName);
		if (!entryPalette)
			throw new Error("palette " + level.paletteName + " not found");
		var palette = new Palette().load(entryPalette.view);
		var palTex: WebGLTexture = initPalette(palette.colors);

		var bufferVertexPosition = gl.createBuffer();
		var bufferVertexTextureCoord = gl.createBuffer();
		var bufferVertexLight = gl.createBuffer();

		for (var iCube = level.cubes.length; iCube--;)
		{
			var cube = level.cubes[iCube];
			for (var iSide = 6; iSide--;)
			{
				var side = cube.rgSides[iSide];
				side.static_light = side.getTextureLighting();
			}
		}

		/* vertex positions
		{
			var unpacked = [];
			level.rgVertices.forEach(function (e) { e.pushTo(unpacked); });

			var texVertexPositions = createTexture();

			gl.bindTexture(gl.TEXTURE_2D, texVertexPositions);
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, level.rgVertices.length, 1, 0, gl.RGB, gl.FLOAT, new Float32Array(unpacked));

			bindTexture(3, texVertexPositions);
			gl.uniform1i(programDouble.sampVertexPositions, 3);
		}
		*/

		var timeStart = new Date().getTime() / 1000;

		var _iTriViewLast = -1;

		var rgCubes = level.cubes;
		var rgSides = Array.prototype.concat.apply([], level.cubes.map(function (c) { return c.rgSides.filter(function (s) { return !s.neighbor; }); }));
		var rgSidesBlended = Array.prototype.concat.apply([], level.cubes.map(function (c) { return c.rgSides.filter(function (s) { return !!s.neighbor; }); }));

		var viewer = level.rgObjects[0];

		viewer.controlType = ControlTypes.FLYING;
		viewer.movementType = MovementTypes.PHYSICS;
		viewer.controls = Keys;

		var flash = viewer.cube.createExplosion(0, viewer.pos.addScale(viewer.orient._[2], viewer.size * .8), viewer.size, KnownVClips.PLAYER_APPEARANCE);
		flash.orient = viewer.orient;
		//_ham.playSound(_ham.rgVClips[KnownVClips.PLAYER_APPEARANCE].sound_num);

		var iWeapon = 0;
		var timeFire = 0;

		var cubeLast: Cube;

		var drawAnimationFrame = function (time: number)
		{
			function fetchVisibility(cube: Cube)
			{
				if (cube && !cube.rgVisibleNeighbors)
				{
					cube.rgVisibleNeighbors = [];
					visibilityWorker.postMessage({ getVisibility: cube.index });
				}
			}

			function renderPath(rgNodes: CubePos[])
			{
				if (!rgNodes || rgNodes.length < 2)
					return;

				var rgVertices: number[] = [];
				var rgColors: number[] = [];
				for (var i = 0; i < rgNodes.length; ++i)
				{
					rgNodes[i].pos.pushTo(rgVertices);
					Vec3.One.pushTo(rgColors);
				}

				var bufferVertices = createBuffer(rgVertices, 3);
				var bufferColors = createBuffer(rgColors, 3);

				useProgram(programFlat);
				gl.uniform3f(programFlat['light'], 1, 1, 1);
				loadAttribBuffer(programFlat['aVertexPosition'], bufferVertices);
				loadAttribBuffer(programFlat['aVertexColor'], bufferColors);
				gl.drawArrays(gl.LINE_STRIP, 0, rgNodes.length);
				gl.deleteBuffer(bufferVertices);
				gl.deleteBuffer(bufferColors);
			}

			var frameTime = (time - _timeLast);
			_timeLast = time;

			//console.log(frameTime);

			if (!frameTime)
				return;

			Keys.updateControls(frameTime);


			// do effects

			_ham.updateEffects(frameTime);

			ExplodingWall.update(time);
			CloakingWall.update(frameTime);

			level.update(time, frameTime);

			if (Keys.firePrimary)
			{
				if (time > timeFire)
				{
					var weapon = _ham.rgWeaponInfos[_player.primary_weapon];
					timeFire = time + weapon.fire_wait;

					viewer.fireLaser(iWeapon, _player.laser_level, 0, !!(_player.flags & PlayerFlags.QUAD_LASERS));
				}
			}

			var pos = viewer.pos;
			var orient = viewer.orient;

			beginScene(pos, orient);

			if (_audio)
			{
				PlayingSound.update();

				var listener = _audio.listener;
				var vel = (<PhysicsInfo>viewer.mover).velocity;

				var lookAt = matModelView.getRow(2);
				var lookUp = matModelView.getRow(1);

				listener.setOrientation(
					-lookAt[0], -lookAt[1], -lookAt[2],
					lookUp[0], lookUp[1], -lookUp[2]
				);

				listener.setPosition(pos.x + lookUp[0] / 100, pos.y + lookUp[1] / 100, pos.z - lookUp[2] / 100);
				// no more doppler :(
				//listener.setVelocity(vel.x, vel.y, vel.z);
			}

			bindTexture(0, palTex);

			gl.enable(gl.DEPTH_TEST);

			//gl.enable(gl.BLEND);
			gl.disable(gl.BLEND);
			gl.disable(gl.DEPTH_TEST);

			var cubeInside = viewer.cube;

			if (cubeInside)
			{
				if (!cubeInside.isPointInside(pos))
				{
					//console.log("OUTSIDE");
					cubeInside = null;
				}
			}

			if (!cubeInside)
			{
				for (var iCube = rgCubes.length; iCube--;)
				{
					var cube = rgCubes[iCube];
					if (cube.isPointInside(pos))
					{
						cubeInside = cube;
						break;
					}
				}
			}


			var rgVisibleCubes: Cube[], rgVisibleSides: Side[], rgVisibleSidesBlended: Side[];

			if (cubeInside)
			{
				if (cubeLast !== cubeInside)
				{
					cubeLast = cubeInside;

					fetchVisibility(cubeInside);

					for (var iSide = 6; iSide--;)
					{
						var side = cubeInside.rgSides[iSide];
						if (side)
							fetchVisibility(side.neighbor);
					}
				}

				rgVisibleCubes = cubeInside.rgVisibleNeighbors || [];
				rgVisibleSides = cubeInside.rgVisibleSides || [];
				rgVisibleSidesBlended = cubeInside.rgVisibleSidesBlended || [];
			}
			else
			{
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
					//delete _stepsDebug._iStep;
					_iStepLast = undefined;
				}
				else if (Keys.stepUp)
				{
					var stepDebug = _stepsDebug[_iStep];
					if (stepDebug.children && stepDebug.children.length)
					{
						_stepsDebug._iStep = _iStep;
						_stackDebug.push(_stepsDebug);

						_stepsDebug = stepDebug.children;
						_iStep = _stepsDebug._iStep || 0;
						_iStepLast = undefined;
					}
				}

				if (_iStepLast != _iStep)
				{
					_iStepLast = _iStep;

					var step = _stepsDebug[_iStep];
					if (step)
					{
						console.log(_stackDebug.length, _cubeDebug.index, step.reject, step);
					}
				}
			}
			*/

			function updateLighting()
			{
				var lightingDistance2 = LIGHT_DISTANCE_THRESHOLD * LIGHT_DISTANCE_THRESHOLD;

				var center = cubeLast.center;

				var rgLightingSides = cubeLast.rgLightingSides;
				if (rgLightingSides)
				{
					var mapObjectLights: { [index: string]: Vec3 } = {};

					for (var i = rgLightingSides.length; i--;)
					{
						var side = rgLightingSides[i];
						var rgVertices = side.vertices;
						var rgVertexLight = side.rgVertexLight;

						rgVertexLight[0] = null;
						rgVertexLight[1] = null;
						rgVertexLight[2] = null;
						rgVertexLight[3] = null;
						side.updateLight = true;

						var rgLightingCubes = side.rgLightingCubes;
						for (var iCube = rgLightingCubes.length; iCube--;)
						{
							var cube = rgLightingCubes[iCube];
							var rgObjects = cube._rgObjects;
							for (var iObject = rgObjects.length; iObject--;)
							{
								var object: object = rgObjects[iObject];
								var objectLight = mapObjectLights[object._unique];
								if (typeof objectLight === 'undefined')
									objectLight = mapObjectLights[object._unique] = object.getEmittedLight(time);

								if (objectLight)
								{
									var pos = object.pos;

									for (var iVertex = 4; iVertex--;)
									{
										var vertex = rgVertices[iVertex];
										var dist2 = vertex.distanceTo2(pos);
										if (dist2 <= lightingDistance2)
										{
											var dist = dist2 < 16 ? 16 : Math.sqrt(dist2);

											var light = rgVertexLight[iVertex];
											if (light)
												light = light.addScale(objectLight, 1 / dist);
											else
												light = objectLight.scale(1 / dist);
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

			//updateLighting();

			if (true)
			{
				gl.disable(gl.CULL_FACE);
				gl.enable(gl.DEPTH_TEST);
				//gl.enable(gl.DEPTH_WRITEMASK);
				gl.depthMask(true);
				gl.depthFunc(gl.ALWAYS);

				useProgram(programSingle);

				if (programSingle['slideU'] || programSingle['slideV'])
				{
					programSingle['slideU'] = 0;
					programSingle['slideV'] = 0;
					gl.uniform2f(programSingle['slide'], 0, 0);
				}

				loadAttribBuffer(programSingle['aVertexPosition'], level.bufferVertexPosition);
				loadAttribBuffer(programSingle['aVertexTextureCoord'], level.bufferVertexTextureCoord);
				loadAttribBuffer(programSingle['aVertexLight'], level.bufferVertexLight);
				loadAttribBuffer(programSingle['aVertexBrightness'], level.bufferVertexTextureBrightness);

				var fWireframe = Keys.wireframe;

				for (var iSide = 0; iSide < rgVisibleSides.length; iSide++)
				{
					/*DEBUG
					if (_cubeDebug)
					{
						var step = _stepsDebug[_iStep];
						if (step && step.minPlanes)
						{
							$(["left", "right", "bottom", "top"]).each(function (i, e)
							{
								var plane = step.minPlanes[i];
								if (plane)
								{
									gl.uniform3f(programSingle[e + "PlaneAnchor"], plane.anchor.x, plane.anchor.y, plane.anchor.z);
									gl.uniform3f(programSingle[e + "PlaneNormal"], plane.normal.x, plane.normal.y, plane.normal.z);
								}
							});
						}
					}
					*/

					var side = rgVisibleSides[iSide];
					if (side.program === programSingle)
						side.render(time, fWireframe);
				}
			}

			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.GEQUAL);

			if (true)
			{
				useProgram(programDouble);

				if (programDouble['slideU'] || programDouble['slideV'])
				{
					programDouble['slideU'] = 0;
					programDouble['slideV'] = 0;
					gl.uniform2f(programDouble['slide'], 0, 0);
				}

				loadAttribBuffer(programDouble['aVertexPosition'], level.bufferVertexPosition);
				loadAttribBuffer(programDouble['aVertexTextureCoord'], level.bufferVertexTextureCoord);
				loadAttribBuffer(programDouble['aVertexLight'], level.bufferVertexLight);
				loadAttribBuffer(programDouble['aVertexBrightness'], level.bufferVertexTextureBrightness);

				for (var iSide = rgVisibleSides.length; iSide--;)
				{
					var side = rgVisibleSides[iSide];
					if (side.program === programDouble)
						side.render(time, fWireframe);
				}
			}

			/*
			function p()
			{
				var posCurrent = new CubePos(viewer.cube, viewer.pos.addScale(Vec3.Y, .01));
				var posStart = new CubePos(rgCubes[0]);
				var path = posStart.createPathTo(posCurrent);
				if (path)
				{
					var optimized: CubePos[] = [];
					for (var iStart = 0; iStart < path.length; ++iStart)
					{
						var start = path[iStart];
						optimized.push(start);

						var iEnd = iStart + 2;
						while (iEnd < path.length)
						{
							var end = path[iEnd];
							var bounce = start.bounce(end.pos);
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

			if (true)
			{
				for (var iCube = rgVisibleCubes.length; iCube--;)
				{
					var cube = rgVisibleCubes[iCube];
					cube.renderObjects(time);
				}
			}

			if (true)
			{
				useProgram(programSingle);

				loadAttribBuffer(programSingle['aVertexPosition'], level.bufferVertexPosition);
				loadAttribBuffer(programSingle['aVertexTextureCoord'], level.bufferVertexTextureCoord);
				loadAttribBuffer(programSingle['aVertexLight'], level.bufferVertexLight);
				loadAttribBuffer(programSingle['aVertexBrightness'], level.bufferVertexTextureBrightness);

				for (var iSide = rgVisibleSidesBlended.length; iSide--;)
				{
					var side = rgVisibleSidesBlended[iSide];
					if (side.program === programSingle)
						side.render(time, fWireframe);
				}

				useProgram(programDouble);

				loadAttribBuffer(programDouble['aVertexPosition'], level.bufferVertexPosition);
				loadAttribBuffer(programDouble['aVertexTextureCoord'], level.bufferVertexTextureCoord);
				loadAttribBuffer(programDouble['aVertexLight'], level.bufferVertexLight);
				loadAttribBuffer(programDouble['aVertexBrightness'], level.bufferVertexTextureBrightness);

				for (var iSide = rgVisibleSidesBlended.length; iSide--;)
				{
					var side = rgVisibleSidesBlended[iSide];
					if (side.program === programDouble)
						side.render(time, fWireframe);
				}
			}

			/*DEBUG
			if (_cubeDebug)
			{
				gl.disable(gl.BLEND);
				gl.disable(gl.DEPTH_TEST);

				gl.disable(gl.CULL_FACE);

				useProgram(programFlat);

				var step = _stepsDebug[_iStep];

				_stepsDebug._iStep = _iStep;
				_stackDebug.push(_stepsDebug);
				for (var i = _stackDebug.length; i--;)
				{
					var stepsRender = _stackDebug[i];
					var stepRender = stepsRender[stepsRender._iStep];
					var sideOther = stepRender.side;

					if (!sideOther.bufferVertexTextureBrightness)
						sideOther.createBuffers();

					loadAttribBuffer(programFlat.aVertexPosition, sideOther.bufferVertexPosition);
					if (i == 0)
						gl.uniform4f(programFlat.color, 1, .5, 1, 0.3);
					else if (i == _stackDebug.length - 1)
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

					for (var i = 4; i--;)
					{
						var extent = step.extents[i];
						if (extent)
						{
							gl.uniform3f(programBillboard.pos, extent.x, extent.y, extent.z);

							var tex = _pig.loadBitmap(i + 1, 1);
							var bmp = tex.bmp;
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

					for (var iEdge = 4; iEdge--;)
					{
						var bufferVertexPositionEdge1 = createBuffer(step.rgEdges[iEdge].flatten(), 3);
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
		}
		console.log('start animation');
		_animationFunction = drawAnimationFrame;
		animate();
	}
}
