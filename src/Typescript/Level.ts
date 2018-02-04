/// <reference path="DataView.ts" />
/// <reference path="DataStream.ts" />
/// <reference path="Math.ts" />

/// <reference path="webgl.ts" />

/// <reference path="Item.ts" />
/// <reference path="Ham.ts" />

/// <reference path="BinaryHeap.ts" />
"use strict";

const _rgrgSideVertexIndices =
	[
		[7, 6, 2, 3],			// left
		[0, 4, 7, 3],			// top
		[0, 1, 5, 4],			// right
		[2, 6, 5, 1],			// bottom
		[4, 5, 6, 7],			// back
		[3, 2, 1, 0],			// front
	];

let _bufferVertexTextureBrightness: WebGLBuffer;
let _bufferVertexLight: WebGLBuffer;

class Level {
	version: number;
	offsetMine: number;
	offsetGame: number;
	paletteName: string;
	reactorTime: number;
	reactorLife: number;
	rgFlickeringLights: FlickeringLight[];
	rgVertices: Vec3[];
	cubes: Cube[];

	rgPOFNames: string[];
	rgObjects: Item[];
	rgRobotCenters: RobotCenter[];

	bufferVertexPosition: WebGLBuffer;
	bufferVertexLight: WebGLBuffer;
	bufferVertexTextureCoord: WebGLBuffer;
	bufferVertexTextureBrightness: WebGLBuffer;

	constructor(view: DataView) {
		const stream = new DataStream(view);

		stream.position = 0;

		const magic = stream.getString(4);
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
		}	// hostage text offset

		if (this.version > 1) {
			this.paletteName = stream.getTerminatedString(["\0", "\n"], 11);
		}
		// TODO: default level palette

		if (this.version >= 3) {
			this.reactorTime = stream.getInt32();
		} else {
			this.reactorTime = 30;
		}

		if (this.version >= 4) {
			this.reactorLife = stream.getInt32();
		}

		let rgFlickeringLights: FlickeringLight[] | null = null;
		if (this.version >= 7) {
			const cLights = stream.getInt32();
			rgFlickeringLights = Array_iterate(cLights, () => new FlickeringLight().load(stream));
		}

		if (this.version >= 6) {
			stream.getInt32();	// secret cube?
		}

		stream.position = this.offsetMine;

		const compiledVersion = stream.getUint8();

		const cVertices = stream.getUint16();
		const cCubes = stream.getUint16();

		const rgVertices = this.rgVertices = stream.getVectorArray(cVertices);

		const _endCube = new Cube(-1);

		const rgCubes = this.cubes = new Array<Cube>(cCubes);

		const rgVertexPosition: number[] = [];
		const rgVertexTextureCoord: number[] = [];
		const rgVertexLight: number[] = [];
		const rgVertexBrightness: number[] = [];

		for (let iCube = 0; iCube < cCubes; ++iCube) {
			// console.log("cube " + iCube);

			const sideMask = stream.getUint8();

			const cube = getCube(iCube);

			let rgNeighbors: Cube[];
			if (this.version === 5) {
				readSpecial(cube, sideMask);
				readVertices(cube);
				rgNeighbors = readChildren(sideMask);
			} else {
				rgNeighbors = readChildren(sideMask);
				readVertices(cube);
				if (this.version <= 1) {
					readSpecial(cube, sideMask);
				}
			}

			if (this.version <= 5) {
				cube.static_light = fix(stream.getUint16() << 4);
			}

			const rgSwitches = new Uint8Array(6);

			const sideMask2 = stream.getUint8();
			for (let iSide = 0; iSide < 6; ++iSide) {
				if (sideMask2 & (1 << iSide)) {
					rgSwitches[iSide] = stream.getUint8();
				} else {
					rgSwitches[iSide] = -1;
				}
			}

			for (let iSide = 0; iSide < 6; ++iSide) {
				const rgSideVertexIndices = _rgrgSideVertexIndices[iSide];
				const rgOtherVertices = rgSideVertexIndices.map((iVertex: number) => cube.rgVertices[iVertex]);
				const neighbor = rgNeighbors[iSide];
				const side = cube.rgSides[iSide] = new Side(cube, iSide, neighbor, rgOtherVertices);

				const iSwitch = rgSwitches[iSide];
				if (iSwitch < 255 || !side.neighbor) {
					side.load(stream);
					// side.tmi = _ham.rgTMapInfos[side.tex1];
					side.iSwitch = iSwitch;
				}
			}
		}

		for (let iCube = 0; iCube < cCubes; ++iCube) {
			const cube = this.cubes[iCube];

			if (this.version > 5) {
				cube.load2(stream);
			}

			for (let iSide = 6; iSide--;) {
				const side = cube.rgSides[iSide];
				side.initializeBuffers(rgVertexPosition, rgVertexLight, rgVertexTextureCoord, rgVertexBrightness);
			}
		}

		// initialize lighting cubes

		for (let iCube = cCubes; iCube--;) {
			const cube = this.cubes[iCube];
			const radius2 = cube.radius * cube.radius;

			for (let iCubeOther = cCubes; iCubeOther--;) {
				const cubeOther = this.cubes[iCubeOther];

				const minDistance = cube.radius + cubeOther.radius + LIGHT_DISTANCE_THRESHOLD;

				if (cube.center.distanceTo2(cubeOther.center) < minDistance * minDistance) {
					for (let iSide = 6; iSide--;) {
						const side = cube.rgSides[iSide];

						let fFound = false;

						for (let iSideVertex = 4; !fFound && iSideVertex--;) {
							const sideVertex = side.vertices[iSideVertex];

							for (let iVertexOtherCube = 8; !fFound && iVertexOtherCube--;) {
								const vertexOtherCube = cubeOther.rgVertices[iVertexOtherCube];

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
			for (let iLight = rgFlickeringLights.length; iLight--;) {
				const fl = rgFlickeringLights[iLight];
				const side = this.getSide(fl.segnum, fl.sidenum);
				side.light = fl;
			}
		}

		stream.position = this.offsetGame;

		const gameSig = stream.getUint16();
		if (gameSig !== 0x6705) {
			throw new Error("invalid level game signature: " + gameSig);
		}

		const gameVersion = stream.getUint16();
		stream.gameVersion = gameVersion;

		stream.position += 31;

		const offsetObjects = stream.getUint32();
		const cObjects = stream.getUint32();

		stream.position += 8;

		const cWalls = stream.getUint32();

		stream.position += 20;

		const cTriggers = stream.getUint32();

		stream.position += 24;

		const triggerSize = stream.getUint32();

		stream.position += 4;

		const cRobotCenters = stream.getUint32();

		stream.position += 4;

		let cStaticLights = 0;
		let cDeltaLights: number = 0;

		if (gameVersion >= 29) {
			stream.position += 4;
			cStaticLights = stream.getUint32();
			stream.position += 8;
			cDeltaLights = stream.getUint32();
			stream.position += 4;
		}

		let levelName: string;
		if (gameVersion >= 31) {
			levelName = stream.getTerminatedString(["\n"]);
		} else if (gameVersion >= 14) {
			levelName = stream.getTerminatedString(["\0"]);
		} else {
			levelName = "";
		}

		if (gameVersion >= 19) {
			const cPOFNames = stream.getUint16();
			if (cPOFNames !== 0x614d && cPOFNames !== 0x5547) {
				this.rgPOFNames = Array_iterate(cPOFNames, (i: number): string => {
					return stream.getTerminatedString(["\0", "\n"], 13);
				}) as string[];
			}
		}

		const $this = this;

		if (offsetObjects >= 0) {
			stream.position = offsetObjects;
			this.rgObjects = Array_iterate(cObjects, (iObject) => {
				const obj = Item.load(stream);
				if (obj.type === ItemTypes.COOP) {
					return;
				}

				const pos = obj.pos;

				let cube = $this.getCube(obj.iCube);
				if (!cube.isPointInside(pos)) {
					console.log("object " + iObject + " outside cube " + cube.index);
					const foundCube = $this.findCubeContaining(pos);
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
		const rgWalls = Array_iterate(cWalls, () => new Wall().load(stream));

		if (gameVersion < 31) {
			throw new Error("level game info version not supported: " + gameVersion);
		}

		// load triggers
		const rgTriggers = Array_iterate(cTriggers, () => new Trigger().load(stream));

		for (let iTrigger = cTriggers; iTrigger--;) {
			const trigger = rgTriggers[iTrigger];
			trigger.rgSides = Array_iterate(trigger.num_links, (i) => $this.getSide(trigger.seg[i], trigger.side[i]));
			// delete trigger.seg;
			// delete trigger.side;
		}

		for (let iWall = cWalls; iWall--;) {
			const wall = rgWalls[iWall];
			wall.iWall = iWall;
			const side = this.getSide(wall.segnum, wall.sidenum);

			side.wall = wall;
			if (!wall.side) {
				wall.side = side;
			}

			const otherSide = side.otherSide;
			if (otherSide) {
				if (otherSide.wall) {
					otherSide.wall.otherWall = wall;
					wall.otherWall = otherSide.wall;
				} else {
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

		const rgControlCenterTriggers = Array_iterate(1, () => new ControlCenterTrigger().load(stream));

		// read materialization centers

		if (gameVersion < 27) {
			throw new Error("level game info version not supported: " + gameVersion);
		}

		this.rgRobotCenters = Array_iterate(cRobotCenters, () => new RobotCenter().load(stream));

		const rgDeltaLightIndices: DeltaLightIndex[] = Array_iterate(cStaticLights, () => new DeltaLightIndex().load(stream));
		const rgDeltaLights = Array_iterate(cDeltaLights, () => new DeltaLight().load(stream));

		for (let iLight = rgDeltaLights.length; iLight--;) {
			const dl = rgDeltaLights[iLight];
			const side = this.getSide(dl.segnum, dl.sidenum);
			dl.side = side;
		}

		for (let iLight = rgDeltaLightIndices.length; iLight--;) {
			const lightIndex = rgDeltaLightIndices[iLight];
			const side = this.getSide(lightIndex.segnum, lightIndex.sidenum);
			side.rgDeltaLights = Array_iterate(lightIndex.count, (i) => rgDeltaLights[lightIndex.index + i]) as DeltaLight[];
		}

		function getCube(i: number): Cube {
			let cube = rgCubes[i];
			if (!cube) {
				cube = rgCubes[i] = new Cube(i);
			}
			return cube;
		}

		function readChildren(sideMask: number): Cube[] {
			const rgNeighbors = new Array<Cube>(6);
			for (let iSide = 0; iSide < 6; ++iSide) {
				if (sideMask & (1 << iSide)) {
					const iNeighbor = stream.getUint16();
					if (iNeighbor < cCubes) {
						rgNeighbors[iSide] = getCube(iNeighbor);
						// console.log("cube " + iCube + " [" + iSide + "] -> " + iNeighbor);
					} else if (iNeighbor === 65534) {
						rgNeighbors[iSide] = _endCube;
					} else if (iNeighbor !== 65535) {
						throw new Error("neighbor out of range");
					}
				}
			}
			return rgNeighbors;
		}

		function readVertices(cube: Cube) {
			let center = Vec3.Zero;
			for (let iVertex = 0; iVertex < 8; ++iVertex) {
				const iCubeVertex = stream.getUint16();
				if (iCubeVertex >= cVertices) {
					throw new Error("vertex index out of range");
				}
				const vertex = rgVertices[iCubeVertex];
				cube.rgVertices[iVertex] = vertex;
				center = center.add(vertex);
			}
			cube.center = center = center.scale(1.0 / 8.0);

			let radius2 = 0;
			for (let iVertex = 0; iVertex < 8; ++iVertex) {
				const dist2 = center.distanceTo2(cube.rgVertices[iVertex]);
				if (radius2 < dist2) {
					radius2 = dist2;
				}
			}
			cube.radius = Math.sqrt(radius2);
		}

		function readSpecial(cube: Cube, sideMask: number) {
			if (sideMask & (1 << 6)) {
				cube.special = stream.getUint8();
				cube.iMatCen = stream.getInt8();
				cube.value = stream.getInt8();
				stream.getInt8();	// skip
				// console.log("cube " + iCube + " special: ", cube.special, cube.iMatCen, cube.value);
			}
		}
	}
	getCube(iCube: number) {
		if (!(iCube >= 0 && iCube < this.cubes.length)) {
			throw new Error("cube index out of range: " + iCube);
		}
		return this.cubes[iCube];
	}
	getSideByIndex(index: SideIndex) {
		return this.getSide(index.iCube, index.iSide);
	}
	getSide(iCube: number, iSide: number) {
		const cube = this.getCube(iCube);
		if (!(iSide >= 0 && iSide < 6)) {
			throw new Error("side index out of range: " + iSide);
		}
		return cube.rgSides[iSide];
	}
	findCubeContaining(pt: Vec3): Cube | null {
		const cubes = this.cubes;
		for (let iCube = cubes.length; iCube--;) {
			const cube = cubes[iCube];
			if (cube.isPointInside(pt)) {
				return cube;
			}
		}
		return null;
	}
	update(time: number, frameTime: number) {
		const rgObjects = this.rgObjects;
		for (let iObject = rgObjects.length; iObject--;) {
			const object = rgObjects[iObject];
			if (!object.update(time, frameTime)) {

				for (var o of this.rgObjects)
				assert(o.cubeIndex >= 0);
					
				object.link(null);

				rgObjects.swapOut(iObject);

				for (var o of this.rgObjects)
				assert(o.cubeIndex >= 0);
			}
		}

		for (var o of this.rgObjects)
			assert(o.cubeIndex >= 0);

		for (let iDoor = _rgActiveDoors.length; iDoor--;) {
			const door = _rgActiveDoors[iDoor];
			if (!door.updateDoor(time, frameTime)) {
				_rgActiveDoors.swapOut(iDoor);
			}
		}
	}
	cleanObjects() {
		const rgObjects = this.rgObjects;
		for (let iObject = rgObjects.length; iObject--;) {
			const object = rgObjects[iObject];
			if (object.isDead()) {
				object.link(null);
				rgObjects.swapOut(iObject);
			}
		}

		for (var o of this.rgObjects)
			assert(o.cubeIndex >= 0);
	}
}
const _rgActiveDoors: Wall[] = [];

let LIGHT_DISTANCE_THRESHOLD = 80;

// values for special field
enum CubeFlags {
	IS_NOTHING = 0,
	IS_FUELCEN = 1,
	IS_REPAIRCEN = 2,
	IS_CONTROLCEN = 3,
	IS_ROBOTMAKER = 4,
	IS_GOAL_BLUE = 5,
	IS_GOAL_RED = 6,
	MAX_CENTER_TYPES = 7,

	AMBIENT_WATER = 8,
	AMBIENT_LAVA = 9,
}
class Cube {

	rgVertices = new Array<Vec3>(8);
	rgSides = new Array<Side>(6);
	center: Vec3;
	radius: number;

	special: CubeFlags;
	matcen_num: number;
	value: number;
	static_light = 1;
	iMatCen: number;

	rgVisibleNeighbors: Cube[];
	rgLightingNeighbors: Cube[];
	rgVisibleSides: Side[];
	rgVisibleSidesBlended: Side[];
	rgLightingSides: Side[];

	_unique = (__unique++).toString();
	_rgObjects: Item[] = [];

	constructor(public index: number) {
	}
	load2(stream: DataStream) {
		this.special = stream.getUint8();
		this.matcen_num = stream.getUint8();
		this.value = stream.getUint8();
		this.special |= (stream.getUint8() << 8);
		this.static_light = stream.getFixed();
	}
	isPointInside(pt: Vec3) {
		const rgSides = this.rgSides;
		for (let iSide = 6; iSide--;) {
			const side = rgSides[iSide];
			if (side && !side.isPointInside(pt)) {
				return false;
			}
		}
		return true;
	}
	render(time: number, fWireframe: boolean) {
		const rgSides = this.rgSides;
		for (let iSide = 6; iSide--;) {
			const side = rgSides[iSide];
			side.render(time, fWireframe);
		}
	}
	renderObjects(time: number, viewPlane?: Plane3) {
		const rgObjects = this._rgObjects;
		for (let iObject = rgObjects.length; iObject--;) {
			const obj: Item = rgObjects[iObject];
			if (viewPlane && viewPlane.distanceTo(obj.pos) < 0) {
				continue;
			}
			obj.render(time);
		}
	}
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

	addStaticLight(value: number) {
		if (!value) {
			return;
		}
		this.static_light += value;

		const center = this.center;
		const rgVisibleNeighbors = this.rgVisibleNeighbors;
		for (let iVisible = rgVisibleNeighbors.length; iVisible--;) {
			const cube = rgVisibleNeighbors[iVisible];
			let distance = center.distanceTo(cube.center);
			if (distance < 1) {
				distance = 1;
			}
			cube.static_light += value / distance;
		}
	}
	bounce(line: LineSegment, size: number): Bounce|null {
		let bestBounce: Bounce|null = null;
		for (let iSide = 6; iSide--;) {
			const side = this.rgSides[iSide];
			const bounce = side.bounce(line, size);
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
	}
	checkExit(line: LineSegment): Side | null {
		for (let iSide = 6; iSide--;) {
			const side = this.rgSides[iSide];
			if (side.checkExit(line)) {
				return side;
			}
		}
		return null;
	}
	createExplosion(time: number, pos: Vec3, size: number, vclip: number, duration?: number) {
		const renderType: RenderTypes = (vclip >= 0) ? RenderTypes.FIREBALL : RenderTypes.NONE;

		const obj = this.createObject(ItemTypes.FIREBALL, vclip, ControlTypes.EXPLOSION, renderType, MovementTypes.NONE, pos, size);
		obj.creationTime = time;
		if (vclip >= 0) {
			obj.renderInfo = new OneShotVClipRenderInfo(vclip);
			obj.deathTime = time + _ham.rgVClips[vclip].play_time;
		} else if (duration) {
			obj.deathTime = duration;
		} else {
			// TODO: huh?
		}

		// TODO: damage other objects

		return obj;
	}
	createObject(type: ItemTypes, id: number, controlType: ControlTypes, renderType: RenderTypes, movementType: MovementTypes, pos: Vec3, size: number) {
		const obj = new Item(type, id);
		obj.pos = pos;
		obj.size = size;
		obj.controlType = controlType;
		obj.renderType = renderType;
		obj.movementType = movementType;
		obj.link(this);
		_level.rgObjects.push(obj);
		return obj;
	}
}
class CubePos {
	pos: Vec3;
	F: number;
	G: number;
	H: number;
	prev: CubePos | null;

	constructor(public cube: Cube, pos?: Vec3) {
		if (!cube) {
			throw new Error();
		}
		if (!pos) {
			this.pos = cube.center;
		}
	}

	createPathTo(dest: CubePos): CubePos[]|null {
		const queueNext = new BinaryHeap(comparePos);
		const mapNext: { [index: string]: CubePos } = {};
		const mapVisited: { [index: string]: CubePos } = {};

		this.G = 0;
		this.prev = null;
		queueNext.push(this);

		while (queueNext.length() > 0) {
			let posCurrent: CubePos|null = queueNext.pop();
			const cubeCurrent = posCurrent.cube;

			if (cubeCurrent === dest.cube) {
				const result: CubePos[] = [];
				for (; posCurrent; posCurrent = posCurrent.prev) {
					result.push(posCurrent);
				}
				result.reverse();
				result.push(dest);
				return result;
			}

			mapVisited[cubeCurrent._unique] = posCurrent;
			for (let iSide = 6; iSide--;) {
				const side = cubeCurrent.rgSides[iSide];
				const cubeNeighbor = side.neighbor;
				if (cubeNeighbor) {
					if (mapVisited[cubeNeighbor._unique]) {
						continue;
					}	// TODO shorten path?

					if (side.getDoorwayFlags() & WID.FLY) {
						const G = posCurrent.G + posCurrent.pos.distanceTo2(cubeNeighbor.center);

						let posNeighbor = mapNext[cubeNeighbor._unique];
						if (posNeighbor) {
							if (posNeighbor.G > G) {
								continue;
							}
							queueNext.remove(posNeighbor);
						} else {
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

		function comparePos(p1: CubePos, p2: CubePos) {
			return p1.F - p2.F;
		}
	}
	bounce(to: Vec3, size = 0): Bounce|null {
		let pos = this.pos;
		let cube = this.cube;
		while (true) {
			const line = new LineSegment(pos, to);
			const bounce = cube.bounce(line, size);
			if (!bounce || bounce.distance > line.length) {
				break;
			}

			const side = bounce.side;
			if (side.isSolid()) {
				return bounce;
			}

			cube = side.neighbor;
			pos = bounce.anchor;
		}

		return null;
	}
}
enum WID {
	FLY = (1 << 0),
	RENDER = (1 << 1),
	RENDPAST = (1 << 2),
	EXTERNAL = (1 << 3),
	CLOAKED = (1 << 4),

	WALL = RENDER,                                // wall
	TRANSPARENT_WALL = RENDER | RENDPAST,         // transparent wall
	ILLUSORY_WALL = RENDER | FLY,                 // illusory wall
	TRANSILLUSORY_WALL = RENDER | FLY | RENDPAST, // transparent illusory wall
	NO_WALL = RENDPAST | FLY,                     // no wall, can fly through

}
const _rgOrientMatrices = [
	Mat3.I,
	Mat3.I.translate2d(-.5, -.5).rotate2d(-3 * Math.PI / 2).translate2d(.5, .5),
	Mat3.I.translate2d(-.5, -.5).rotate2d(-Math.PI).translate2d(.5, .5),
	Mat3.I.translate2d(-.5, -.5).rotate2d(-Math.PI / 2).translate2d(.5, .5),
].map((m) => m.transpose());

class SideIndex {
	constructor(public iCube: number, public iSide: number) {
	}
}

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

class Side {
	static _updateBrightnessItems: Float32Array = new Float32Array(4);
	static _updateLightItems: Float32Array = new Float32Array(4 * 3);

	static_light = 1;
	deltaLight = 1;
	rgDeltaLight: number[] = [1, 1, 1, 1];
	tex2Orient = 0;
	brightness = 1;
	updateBrightness = false;

	vertexOffset: number;
	rgTriangles: Triangle[];
	convex: boolean;
	normal: Vec3;
	center: Vec3;

	iSwitch: number;

	otherSide: Side;
	wall: Wall;
	otherWall: Wall;

	program: WebGLProgram;
	iVertex: number;
	rgUV: Vec2[];
	rgL: Float32Array;

	tex1: number;
	tmi1: TMapInfo;
	tex2: number;
	tmi2: TMapInfo;

	rgDeltaLights: DeltaLight[];

	rgVertexLight = new Array<Vec3 | null>(4);
	updateLight: boolean;

	light: FlickeringLight;
	rgLightingCubes: Cube[] = [];

	_unique: string;

	cubeIndex: { iCube:number, iSide: number };

	constructor(public cube: Cube, public index: number, public neighbor: Cube, public vertices: Vec3[]) {
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

		let sum = Vec3.Zero;
		for (let i = 4; i--;) {
			sum = sum.add(vertices[i]);
		}
		this.center = sum.scale(1 / 4);
	}
	getIndex() {
		return new SideIndex(this.cube.index, this.index);
	}
	load(stream: DataStream) {
		const tex1 = stream.getUint16();
		if (tex1 & (1 << 15)) {
			this.setTex2(stream.getUint16(), true);
		}

		this.setTex1(tex1 & ~(1 << 15));

		this.rgUV = new Array<Vec2>(4);
		this.rgL = new Float32Array(4);

		for (let iVertex = 0; iVertex < 4; ++iVertex) {
			this.rgUV[iVertex] = new Vec2(fix(stream.getInt16()) * 32, fix(stream.getInt16()) * 32);
			this.rgL[iVertex] = fix(stream.getUint16() << 1);
		}

		// this.createBuffers();
	}
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

	initializeBuffers(rgVertexPosition: number[], rgVertexLight: number[], rgVertexTextureCoord: number[], rgVertexBrightness: number[]) {
		const neighbor = this.neighbor;
		let vertexOffset = 0;

		const vertices = this.vertices;

		const tri = new Triangle(vertices[0], vertices[1], vertices[2]);
		let fConvex = tri.distanceTo(vertices[3]) >= 0;

		if (neighbor && neighbor.index !== -1) {
			let otherSide = this.otherSide;
			// initialize otherSide pairs
			if (!otherSide) {
				for (let iOtherSide = 6; iOtherSide--;) {
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
				} else {
					if (this.vertices[0] !== otherSide.vertices[0] &&
						this.vertices[0] !== otherSide.vertices[2]) {
						throw new Error("otherSide vertex mismatch!");
					}
				}
			}
		} else {
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

		const n1 = this.rgTriangles[0].normal;
		const n2 = this.rgTriangles[1].normal;

		this.normal = n1.add(n2).unit();

		if (this.rgUV) {
			this.iVertex = rgVertexPosition.length / 3;

			if (this.tmi2) {
				this.program = programDouble;
			} else {
				this.program = programSingle;
			}

			for (let iVertex = 0; iVertex < 4; ++iVertex) {
				this.vertices[(vertexOffset + iVertex) % 4].pushTo(rgVertexPosition);
				rgVertexLight.push(0, 0, 0);	// TODO: single value
				rgVertexBrightness.push(this.rgL[(vertexOffset + iVertex) % 4]);
				this.rgUV[(vertexOffset + iVertex) % 4].pushTo(rgVertexTextureCoord);
			}
		}
	}
	isVisible() {
		if (!this.neighbor) {
			return true;
		}
		if (this.wall) {
			return this.wall.isVisible();
		}
		return false;
	}
	isSolid() {
		if (!this.neighbor) {
			return true;
		}
		if (this.wall) {
			return this.wall.isSolid();
		}
		return false;
	}
	isTransparent() {
		if (this.tmi2) {
			return this.tmi2.isTransparent();
		}
		return this.tmi1.isTransparent();
	}
	isPointInside(pt: Vec3) {
		if (this.convex) {
			return this.rgTriangles[0].distanceTo(pt) > 0 && this.rgTriangles[1].distanceTo(pt) > 0;
		} else {
			return this.rgTriangles[0].distanceTo(pt) > 0 || this.rgTriangles[1].distanceTo(pt) > 0;
		}
	}
	render(time: number, fWireframe: boolean) {
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

		const program = this.program;

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

		let alpha = 1;
		const wall = this.wall;
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

		let slideU = 0;
		let slideV = 0;
		const sideL = 0;

		const tmi = this.tmi1;
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

		const tmi2 = this.tmi2;
		if (tmi2) {
			const iOrient = this.tex2Orient;
			if (program._iOrient !== iOrient) {
				program._iOrient = iOrient;
				const matOrient = _rgOrientMatrices[iOrient];
				gl.uniformMatrix3fv(program.matOrientTex2, false, matOrient.flatten());
			}
			bindTexture(2, tmi2.loadTexture(2).tex);
		}

		const vertexOffset = this.vertexOffset;

		if (this.updateBrightness) {
			this.updateBrightness = false;

			const items = Side._updateBrightnessItems;
			for (let iVertex = 4; iVertex--;) {
				items[iVertex] = this.rgDeltaLight[(vertexOffset + iVertex) % 4] * this.rgL[(vertexOffset + iVertex) % 4] * this.brightness;
			}

			updateDynamicBuffer(_bufferVertexTextureBrightness, this.iVertex * 4, items);
		}

		if (this.updateLight) {
			this.updateLight = false;

			const items = Side._updateLightItems;
			for (let iVertex = 4; iVertex--;) {
				const light = this.rgVertexLight[(vertexOffset + iVertex) % 4];
				if (light) {
					items[iVertex * 3 + 0] = light.x;
					items[iVertex * 3 + 1] = light.y;
					items[iVertex * 3 + 2] = light.z;
				} else {
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
		} else {
			gl.drawArrays(gl.TRIANGLE_FAN, this.iVertex, 4);
		}
	}
	getPixel(u: number, v: number) {
		return this.tmi1.getPixel(u, v);
	}
	getPixel2(u: number, v: number) {
		const tmi2 = this.tmi2;
		if (!tmi2) {
			throw new Error();
		}

		const iOrient = this.tex2Orient;
		const matOrient = _rgOrientMatrices[iOrient];
		const uv = matOrient.multiply(new Vec3(u, v, 1));
		return tmi2.getPixel(uv.x, uv.y);
	}
	bounce(line: LineSegment, size: number) {
		/*
		if (this.neighbor && !this.isSolid())
			return;
		*/

		if (!this.isSolid()) {
			size = 0;
		}

		let bestBounce: Bounce|null = null;
		for (let iTri = 2; iTri--;) {
			const tri = this.rgTriangles[iTri];
			const bounce = tri.bounce(line, size);
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
	}
	checkExit(line: LineSegment): Bounce | null {
		if (!this.neighbor) {// || this.isVisible ())
			return null;
		}

		for (let iTri = 2; iTri--;) {
			const tri = this.rgTriangles[iTri];
			const bounce = tri.bounce(line, 0);
			if (bounce) {
				return bounce;
			}
		}
		return null;
	}
	getTextureLighting() {
		let lighting = 0;

		if (this.tmi1) {
			lighting += this.tmi1.lighting;
		}

		if (this.tmi2) {
			lighting += this.tmi2.lighting;
		}

		return lighting;
	}
	setTex1(tex: number) {
		this.tex1 = tex;
		this.tmi1 = _ham.rgTMapInfos[tex];
	}
	setTex2(tex: number, fOrient?: boolean) {
		if (fOrient) {
			this.tex2Orient = (tex >> 14) & 3;
			tex = tex & 0x3fff;
		}

		this.tex2 = tex;
		this.tmi2 = _ham.rgTMapInfos[tex];

		// const lighting = this.getTextureLighting();
		// this.setStaticLight(lighting);
	}
	setStaticLight(value: number) {
		const prev = this.static_light;
		this.static_light = value;
		this.cube.addStaticLight(value - prev);
	}
	setDeltaLight(value: number) {
		const light = this.deltaLight;
		const diff = value - light;
		if (diff === 0) {
			return;
		}
		this.deltaLight = value;

		const rgDeltaLights = this.rgDeltaLights;
		if (rgDeltaLights) {
			for (let iDeltaLight = rgDeltaLights.length; iDeltaLight--;) {
				const dl = rgDeltaLights[iDeltaLight];
				const litSide = dl.side;
				litSide.applyDeltaLight(dl, diff);
			}
		}
	}
	applyDeltaLight(light: DeltaLight, diff: number) {
		const rgDeltaLight = this.rgDeltaLight;
		let sum = 0;
		for (let iVertex = 4; iVertex--;) {
			const vertLight = light.vert_light[iVertex];
			sum += vertLight;
			rgDeltaLight[iVertex] += diff * vertLight;
		}
		const avg = sum / 4;
		console.log("CUBE:", this.cube.index, "SIDE:", this.index, "light:", avg * diff);

		this.updateBrightness = true;
	}
	setBrightness(value: number) {
		this.brightness = value;
		this.updateBrightness = true;
	}
	getDoorwayFlags() {
		if (!this.neighbor) {
			return WID.RENDER;
		}

		const wall = this.wall;
		if (!wall) {
			return WID.NO_WALL;
		}

		return wall.getDoorwayFlags();
	}
}
class FlickeringLight {
	segnum: number;
	sidenum: number;
	mask: number;
	timer: number;
	delay: number;

	load(stream: DataStream) {
		this.segnum = stream.getInt16();
		this.sidenum = stream.getInt16();
		this.mask = stream.getInt32();
		this.timer = stream.getFixed();
		this.delay = stream.getFixed();

		return this;
	}
}
enum WallTypes {
	NORMAL = 0,   // Normal wall
	BLASTABLE = 1,   // Removable (by shooting) wall
	DOOR = 2,   // Door
	ILLUSION = 3,   // Wall that appears to be there, but you can fly thru
	OPEN = 4,   // Just an open side. (Trigger)
	CLOSED = 5,   // Wall.  Used for transparent walls.
	OVERLAY = 6,   // Goes over an actual solid side.  For triggers
	CLOAKED = 7,   // Can see it, and see through it
}
enum WallFlags {
	BLASTED = (1 << 0), // Blasted out wall.
	DOOR_OPENED = (1 << 1), // Open door.

	DOOR_LOCKED = (1 << 3), // Door is locked.
	DOOR_AUTO = (1 << 4), // Door automatically closes after time.
	ILLUSION_OFF = (1 << 5), // Illusionary wall is shut off.
	WALL_SWITCH = (1 << 6), // This wall is openable by a wall switch.
	BUDDY_PROOF = (1 << 7), // Buddy assumes he cannot get through this wall.
}
enum DoorStates {
	CLOSED = 0,       // Door is closed
	OPENING = 1,       // Door is opening.
	WAITING = 2,       // Waiting to close
	CLOSING = 3,       // Door is closing
	OPEN = 4,       // Door is open, and staying open
	CLOAKING = 5,       // Wall is going from closed -> open
	DECLOAKING = 6,       // Wall is going from open -> closed
}
enum DoorKeys {
	NONE = (1 << 0),
	BLUE = (1 << 1),
	RED = (1 << 2),
	GOLD = (1 << 3),
}
const DOOR_WAIT_TIME = 5;

class Wall {

	segnum: number;
	sidenum: number;
	hps: number;
	linked_wall: number;
	type: WallTypes;
	flags: WallFlags;
	state: DoorStates;
	iTrigger: number;
	clip_num: number;
	keys: number;
	controlling_trigger: number;
	cloak_value: number;

	side: Side;
	otherSide: Side;
	otherWall: Wall;
	time: number;
	trigger: Trigger;

	cloakingWall: CloakingWall | null;

	private _unique: string;

	constructor() {
		this._unique = (__unique++).toString();
	}
	load(stream: DataStream) {
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
	}
	isVisible(): boolean {
		switch (this.type) {
			case WallTypes.OPEN:
				return false;

			case WallTypes.ILLUSION:
				return !(this.flags & WallFlags.ILLUSION_OFF);

			// case WallTypes.CLOAKED:
			// 	return true;	// TODO
		}

		return true;
	}
	isSolid(): boolean {
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
	}
	getDoorwayFlags() {
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
	}
	damage(time: number, damage: number) {
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

		const wclip = _ham.rgWClips[this.clip_num];
		const cFrames = wclip.num_frames;

		if (this.hps < 100 / cFrames) {
			// blast blastable
			this.blast(time);
		} else {
			// wall_set_tmap_num
			const iFrame = Math.floor((cFrames - 1) * (100 - this.hps) / (100 - 100 / cFrames + 1));
			wclip.apply(this.side, iFrame);
		}
	}
	blast(time: number) {
		this.hps = -1;

		const wclip = _ham.rgWClips[this.clip_num];
		if (wclip.flags & WClipFlags.EXPLODES) {
			this.explode(time);
		} else {
			const wclip = _ham.rgWClips[this.clip_num];
			wclip.apply(this.side, wclip.num_frames - 1);

			this.flags |= WallFlags.BLASTED;
			if (this.otherWall) {
				this.otherWall.flags |= WallFlags.BLASTED;
			}
		}
	}
	explode(time: number) {
		ExplodingWall.add(new ExplodingWall(time, this));
		_ham.playSound(SoundFile_Sounds.EXPLODING_WALL, this.side.center);
	}
	openDoor() {
		const wclip = _ham.rgWClips[this.clip_num];

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
	}
	updateDoor(time: number, frameTime: number) {
		let fActive = true;
		const wclip = _ham.rgWClips[this.clip_num];

		switch (this.state) {
			case DoorStates.OPENING:

				this.time += frameTime;
				if (this.time > wclip.play_time / 2) {
					this.flags |= WallFlags.DOOR_OPENED;
					if (this.otherWall) {
						this.otherWall.flags |= WallFlags.DOOR_OPENED;
					}
				}

				const cFrames = wclip.num_frames;
				let iFrame = Math.floor(cFrames * this.time / wclip.play_time);

				if (iFrame >= cFrames - 1) {
					iFrame = cFrames - 1;

					if (this.flags & WallFlags.DOOR_AUTO) {
						this.state = DoorStates.WAITING;
						if (this.otherWall) {
							this.otherWall.state = DoorStates.WAITING;
						}

						this.time = 0;
					} else {
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

					const cFrames = wclip.num_frames;
					let iFrame = cFrames - 1 - Math.floor(cFrames * this.time / wclip.play_time);

					if (iFrame <= 0) {
						iFrame = 0;
						this.state = DoorStates.CLOSED;
						if (this.otherWall) {
							this.otherWall.state = DoorStates.CLOSED;
						}
						fActive = false;
					}

					wclip.apply(this.side, iFrame);

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
	}
}
const EXPL_WALL_TOTAL_FIREBALLS = 32;
const EXPL_WALL_FIREBALL_SIZE = fix(0x48000) * 6 / 10;
const EXPL_WALL_TIME = 1;

class ExplodingWall {
	static _rgExplodingWalls: ExplodingWall[] = [];

	static add(wall: ExplodingWall) {
		ExplodingWall._rgExplodingWalls.push(wall);
	}
	static update(time: number) {
		for (let iEffect = ExplodingWall._rgExplodingWalls.length; iEffect--;) {
			const effect = ExplodingWall._rgExplodingWalls[iEffect];
			if (!effect.update(time)) {
				ExplodingWall._rgExplodingWalls.swapOut(iEffect);
			}
		}
	}

	cFireballs = 0;

	constructor(public startTime: number, public wall: Wall) {
	}
	update(time: number) {
		const duration = Math.min(time - this.startTime, EXPL_WALL_TIME);

		const cFireballs = EXPL_WALL_TOTAL_FIREBALLS * (duration / EXPL_WALL_TIME) * (duration / EXPL_WALL_TIME);

		const wall = this.wall;
		const side = wall.side;
		const cube = side.cube;
		const normal = side.rgTriangles[0].normal;
		const v0 = side.vertices[1];
		const u = side.vertices[0].sub(v0);
		const v = side.vertices[2].sub(v0);

		if (!(wall.flags & WallFlags.BLASTED) && duration > EXPL_WALL_TIME * 3 / 4) {
			wall.flags |= WallFlags.BLASTED;
			if (wall.otherWall) {
				wall.otherWall.flags |= WallFlags.BLASTED;
			}
			const wclip = _ham.rgWClips[wall.clip_num];
			wclip.apply(side, wclip.num_frames - 1);
		}

		for (let e = this.cFireballs; e < cFireballs; ++e) {
			const size = EXPL_WALL_FIREBALL_SIZE + (2 * EXPL_WALL_FIREBALL_SIZE * e / EXPL_WALL_TOTAL_FIREBALLS);

			let pos = v0.addScale(u, Math.random()).addScale(v, Math.random());

			let scale = size * (EXPL_WALL_TOTAL_FIREBALLS - e) / EXPL_WALL_TOTAL_FIREBALLS;
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
	}

}
const MAX_WALLS_PER_LINK = 10;

class Trigger {
	type: TriggerTypes;
	flags: TriggerFlags;
	num_links: number;
	pad: number;
	value: number;
	time: number;

	seg: number[];
	side: number[];

	rgSides: Side[];

	load(stream: DataStream) {
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
	}
	trigger(obj: Item, time: number, fShot?: boolean) {
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
				for (let iSide = this.rgSides.length; iSide--;) {
					const side = this.rgSides[iSide];
					const wall = side.wall;
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
				for (let iSide = this.rgSides.length; iSide--;) {
					const side = this.rgSides[iSide];
					const wall = side.wall;
					if (side.tmi1.flags & TMapInfoFlags.FORCE_FIELD) {
						wall.type = WallTypes.OPEN;
						if (wall.otherWall) {
							wall.otherWall.type = WallTypes.OPEN;
						}
						_ham.playSound(SoundFile_Sounds.FORCEFIELD_OFF, side.center);
					} else if (wall.type !== WallTypes.OPEN) {
						switch (wall.state) {
							case DoorStates.CLOAKING:
								return;
							case DoorStates.DECLOAKING:
								const cloakingWall = notNull(wall.cloakingWall);
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
				for (let iSide = this.rgSides.length; iSide--;) {
					const wall = this.rgSides[iSide].wall;
					if (wall) {
						wall.flags |= WallFlags.DOOR_LOCKED;
					}
				}
				break;

			case TriggerTypes.UNLOCK_DOOR:
				for (let iSide = this.rgSides.length; iSide--;) {
					const wall = this.rgSides[iSide].wall;
					if (wall) {
						wall.flags &= ~WallFlags.DOOR_LOCKED;
						wall.keys = 0;
					}
				}
				break;

			default:
				throw new Error("unsupported trigger type: " + this.type);

		}
	}
}
enum TriggerTypes {
	OPEN_DOOR = 0,   // Open a door
	CLOSE_DOOR = 1,   // Close a door
	MATCEN = 2,   // Activate a matcen
	EXIT = 3,   // End the level
	SECRET_EXIT = 4,   // Go to secret level
	ILLUSION_OFF = 5,   // Turn an illusion off
	ILLUSION_ON = 6,   // Turn an illusion on
	UNLOCK_DOOR = 7,   // Unlock a door
	LOCK_DOOR = 8,   // Lock a door
	OPEN_WALL = 9,   // Makes a wall open
	CLOSE_WALL = 10,  // Makes a wall closed
	ILLUSORY_WALL = 11,  // Makes a wall illusory
	LIGHT_OFF = 12,  // Turn a light off
	LIGHT_ON = 13,  // Turn a light on
}
enum TriggerFlags {
	NO_MESSAGE = (1 << 0),   // Don't show a message when triggered
	ONE_SHOT = (1 << 1),   // Only trigger once
	DISABLED = (1 << 2),   // Set after one-shot fires
}
const _rgCloakingWalls: CloakingWall[] = [];

class CloakingWall {
	static update(frameTime: number) {
		for (let iCloakingWall = _rgCloakingWalls.length; iCloakingWall--;) {
			const cloakingWall = _rgCloakingWalls[iCloakingWall];
			if (!cloakingWall.update(frameTime)) {
				cloakingWall.wall.cloakingWall = null;
				_rgCloakingWalls.swapOut(iCloakingWall);
			}
		}
	}

	time: number;

	constructor(public wall: Wall) {
		wall.state = DoorStates.CLOAKING;
		if (wall.otherWall) {
			wall.otherWall.state = DoorStates.CLOAKING;
		}

		this.reset(0);
	}
	reset(time: number) {
		this.time = time;
	}
	updateLight(scale: number) {
		// console.log("updateLight: " + scale);
		const wall = this.wall;
		wall.side.setBrightness(scale);
		if (wall.otherWall) {
			wall.otherWall.side.setBrightness(scale);
		}
	}
	update(frameTime: number) {
		this.time += frameTime;

		const wall = this.wall;
		const otherWall = wall.otherWall;

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
		} else if (this.time > CLOAKING_WALL_TIME / 2) {
			let light_scale = 2 * this.time / CLOAKING_WALL_TIME - 1;
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
			} else {
				wall.type = WallTypes.OPEN;
				if (otherWall) {
					otherWall.type = WallTypes.OPEN;
				}

				this.updateLight(light_scale);
			}
		} else {
			let light_scale = 1 - this.time * 2 / CLOAKING_WALL_TIME;
			if (light_scale < 0) {
				light_scale = 0;
			}

			if (wall.state === DoorStates.CLOAKING) {
				this.updateLight(light_scale);
			} else {
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
	}

}
const CLOAKING_WALL_TIME = 1;

const White = Vec3.One;

const MAX_CONTROLCEN_LINKS = 10;

class ControlCenterTrigger {
	num_links: number;
	seg: number[];
	side: number[];

	load(stream: DataStream) {
		this.num_links = stream.getInt16();
		this.seg = stream.getInt16Array(MAX_CONTROLCEN_LINKS);
		this.side = stream.getInt16Array(MAX_CONTROLCEN_LINKS);

		return this;
	}
}
class RobotCenter {
	robot_flags: number[];
	hit_points: number;
	interval: number;
	segnum: number;
	fuelcen_num: number;

	constructor() {
		this.robot_flags = [];
	}
	load(stream: DataStream) {
		this.robot_flags = [
			stream.getInt32(),
			stream.getInt32(),
		];

		this.hit_points = stream.getFixed();
		this.interval = stream.getFixed();
		this.segnum = stream.getInt16();
		this.fuelcen_num = stream.getInt16();

		return this;
	}
}
class DeltaLightIndex {
	segnum: number;
	sidenum: number;
	count: number;
	index: number;

	load(stream: DataStream) {
		this.segnum = stream.getInt16();
		this.sidenum = stream.getUint8();
		this.count = stream.getUint8();
		this.index = stream.getInt16();

		return this;
	}
}
class DeltaLight {
	segnum: number;
	sidenum: number;
	vert_light: number[];
	side: Side;

	load(stream: DataStream) {
		this.segnum = stream.getInt16();
		this.sidenum = stream.getUint8();
		stream.position += 1;	// dummy

		this.vert_light = [
			stream.getUint8() / (256 >> 3),
			stream.getUint8() / (256 >> 3),
			stream.getUint8() / (256 >> 3),
			stream.getUint8() / (256 >> 3),
		];

		return this;
	}
}
