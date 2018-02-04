/// <reference path="Math.ts" />
/// <reference path="Level.ts" />

//importScripts("Math.js");

let _level: Level;
//let LIGHT_DISTANCE_THRESHOLD: number;

interface Vec3 {
	__proto__: Vec3
}

interface Triangle {
	__proto__: Triangle
}

self.onmessage = (event) => {
	const data = event.data;
	if (data) {
		for (const key in data) {
			if (!data.hasOwnProperty(key)) {
				continue;
			}

			const value = data[key];
			switch (key) {
				case "load":
					_level = value.level;
					LIGHT_DISTANCE_THRESHOLD = value.LIGHT_DISTANCE_THRESHOLD;

					for (let iCube = _level.cubes.length; iCube--;) {
						const cube = _level.cubes[iCube];
						cube.center.__proto__ = Vec3.prototype;
						for (let iSide = cube.rgSides.length; iSide--;) {
							const side = cube.rgSides[iSide];
							side.cubeIndex = {
								iCube,
								iSide,
							};

							/*
							side.index = {
								cube: iCube,
								side: iSide
							}
							*/
							let center = Vec3.Zero;
							for (let iVertex = side.vertices.length; iVertex--;) {
								const vertex = side.vertices[iVertex];
								vertex.__proto__ = Vec3.prototype;
								center = center.add(vertex);
							}
							side.center = center.scale(0.25);
							for (let iTriangle = side.rgTriangles.length; iTriangle--;) {
								const tri = side.rgTriangles[iTriangle];
								tri.__proto__ = Triangle.prototype;
							}
						}
					}

					break;

				case "getVisibility":
					const iCube: number = value;
					const cube = _level.cubes[iCube];

					getVisibleNeighbors(cube);

					(self as any).postMessage({
						setVisibility: {
							iCube,
							rgVisibleNeighbors: cube.rgVisibleNeighbors.map((c) => c.index),
							rgLightingNeighbors: cube.rgLightingNeighbors.map((c) => c.index),
							rgVisibleSides: cube.rgVisibleSides.map((s) => s.cubeIndex),
							rgVisibleSidesBlended: cube.rgVisibleSidesBlended.map((s) => s.cubeIndex),
						},
					});

					break;
			}
		}
	}
};
function getVisibleNeighbors(root: Cube) {
	const rgVisible: Cube[] = [];
	const rgLightingNeighbors: Cube[] = [];
	const mapVisible: { [index: string]: Cube } = {};

	const rgVisibleSides: Side[] = [];
	const rgVisibleSidesBlended: Side[] = [];
	const mapVisibleSides: { [index: string]: Side } = {};

	const mapVisited: { [index: string]: boolean } = {};
	const rgVisited: Side[] = [];

	const LIGHT_DISTANCE_THRESHOLD2 = LIGHT_DISTANCE_THRESHOLD * LIGHT_DISTANCE_THRESHOLD;
	const center = root.center;

	for (let iSide = 6; iSide--;) {
		const side = root.rgSides[iSide];
		const rgVertices = side.vertices;

		const rgEdges = new Array<LineSegment>(4);
		const rgReverses = new Array<Plane3>(4);

		for (let iEdge = 4; iEdge--;) {
			const edge = new LineSegment(rgVertices[iEdge], rgVertices[(iEdge + 1) % 4]);
			rgEdges[iEdge] = edge;
			rgReverses[iEdge] = Plane3.fromPoints(edge.start, rgVertices[(iEdge + 3) % 4], edge.end);
			rgReverses[iEdge].normal = rgReverses[iEdge].normal.unit();
		}

		const recurse = (cube: Cube, rgPlanes: Plane3[], depth: number): void => {
			if (depth > 25) {
				return;
			}

			mapVisited[cube._unique] = true;

			if (!mapVisible[cube.index]) {
				mapVisible[cube.index] = cube;
				rgVisible.push(cube);
				if (center.distanceTo(cube.center) < LIGHT_DISTANCE_THRESHOLD2) {
					rgLightingNeighbors.push(cube);
				}
			}

			for (let iOtherSide = 6; iOtherSide--;) {
				const otherSide = cube.rgSides[iOtherSide];
				const neighbor = otherSide.neighbor;

				if (neighbor) {
					if (mapVisited[neighbor._unique]) {
						continue;
					}

					if (!neighbor.center) {
						continue;
					}
				} else {
					if (mapVisibleSides[otherSide._unique]) {
						continue;
					}
				}

				rgVisited.push(otherSide);

				const minPlanes = new Array<Plane3>(4);

				const rgOtherVertices = otherSide.vertices;
				const rgOtherTriangles = otherSide.rgTriangles;
				let fOutside = false;
				const fFrontSide = false;
				for (let iEdge = 4; iEdge--;) {
					const edge = rgEdges[iEdge];
					const vertex = edge.start;
					if (true || rgOtherTriangles[0].distanceTo(vertex) >= 0 || rgOtherTriangles[1].distanceTo(vertex) >= 0) {
						let minPlane = rgReverses[iEdge];

						const plane = rgPlanes[iEdge];
						let extent: Vec3;

						let fFront = false;
						let fBehind = false;

						for (let iVertex = 4; iVertex--;) {
							const vertexOther = rgOtherVertices[iVertex];

							if (plane.distanceTo(vertexOther) < 0) {
								fBehind = true;
								if (fFront) {
									break;
								}
							} else {
								fFront = true;
								if (fBehind) {
									break;
								}

								if (minPlane.distanceTo(vertexOther) < -.0001) {
									minPlane = new Plane3(vertex, edge.direction.cross(vertexOther.sub(vertex)).unit());
									extent = vertexOther;
								}
							}
						}

						if (fBehind) {
							if (fFront) {
								minPlane = plane;
							} else {
								fOutside = true;
								break;
							}
						}

						minPlanes[iEdge] = minPlane;
					}/* else {
						const newStart = edge.intersectPlane(rgOtherTriangles[0]);
						if (newStart) {
							minPlanes[iEdge] = new Plane3(newStart, rgOtherTriangles[0].normal.unit().neg());
						} else {
							minPlanes[iEdge] = rgReverses[iEdge].reverse();
						}
					}*/
				}

				if (!fOutside) {
					if (!mapVisibleSides[otherSide._unique]) {
						mapVisibleSides[otherSide._unique] = otherSide;
						if (neighbor) {
							rgVisibleSidesBlended.push(otherSide);
						} else {
							rgVisibleSides.push(otherSide);
						}
					}

					if (neighbor) {
						recurse(neighbor, minPlanes, depth + 1);
					}
				}
				rgVisited.pop();
			}

			delete mapVisited[cube._unique];
		};

		const rgInits = rgReverses.map((p) => p.reverse());
		recurse(root, rgInits, 1);
	}
	// console.log(rgVisibleSides.length);

	function compareSides(side1: Side, side2: Side): number {
		if (side1.tex1 !== side2.tex1) {
			return side1.tex1 - side2.tex1;
		}
		return side1.tex2 - side2.tex2;
	}
	// rgVisibleSides.sort(compareSides);
	// rgVisibleSidesBlended.sort(compareSides);

	rgVisibleSides.sort((s1, s2) => {
		const d1 = s1.center.distanceTo2(root.center);
		const d2 = s2.center.distanceTo2(root.center);
		return d2 - d1;
	});

	rgVisibleSidesBlended.sort((s1, s2) => {
		const d1 = s1.center.distanceTo2(root.center);
		const d2 = s2.center.distanceTo2(root.center);
		return d1 - d2;
	});

	root.rgVisibleNeighbors = rgVisible;
	root.rgLightingNeighbors = rgLightingNeighbors;
	root.rgVisibleSides = rgVisibleSides;
	root.rgVisibleSidesBlended = rgVisibleSidesBlended;

	return rgVisible;
}
