/// <reference path="Math.ts" />
/// <reference path="Level.ts" />

importScripts('Math.js');

var _level:Level;
var LIGHT_DISTANCE_THRESHOLD:number;

self.onmessage = function (event)
{
	var data = event.data;
	if (data)
	{
		for (var key in data)
		{
			var value = data[key];
			switch (key)
			{
				case "load":
					_level = value.level;
					LIGHT_DISTANCE_THRESHOLD = value.LIGHT_DISTANCE_THRESHOLD;

					for (var iCube = _level.cubes.length; iCube--;)
					{
						var cube = _level.cubes[iCube];
						cube.center["__proto__"] = Vec3.prototype;
						for (var iSide = cube.rgSides.length; iSide--;)
						{
							var side = cube.rgSides[iSide];
							side["cubeIndex"] = {
								iCube: iCube,
								iSide: iSide
							};

							/*
							side.index = {
								cube: iCube,
								side: iSide
							}
							*/
							var center = Vec3.Zero;
							for (var iVertex = side.vertices.length; iVertex--;)
							{
								var vertex = side.vertices[iVertex];
								vertex["__proto__"] = Vec3.prototype;
								center = center.add(vertex);
							}
							side.center = center.scale(0.25);
							for (var iTriangle = side.rgTriangles.length; iTriangle--;)
							{
								var tri = side.rgTriangles[iTriangle];
								tri["__proto__"] = Triangle.prototype;
							}
						}
					}

					break;

				case "getVisibility":
					var iCube:number = value;
					var cube = _level.cubes[iCube];

					getVisibleNeighbors(cube);

					(<any>self).postMessage({
						setVisibility: {
							iCube: iCube,
							rgVisibleNeighbors: cube.rgVisibleNeighbors.map(function (c) { return c.index; }),
							rgLightingNeighbors: cube.rgLightingNeighbors.map(function (c) { return c.index; }),
							rgVisibleSides: cube.rgVisibleSides.map(function (s) { return s["cubeIndex"]; }),
							rgVisibleSidesBlended: cube.rgVisibleSidesBlended.map(function (s) { return s["cubeIndex"]; }),
						}
					});

					break;
			}
		}
	}
}
function getVisibleNeighbors(root:Cube)
{
	var rgVisible:Cube[] = [];
	var rgLightingNeighbors:Cube[] = [];
	var mapVisible: { [index: string]: Cube } = {};

	var rgVisibleSides:Side[] = [];
	var rgVisibleSidesBlended: Side[] = [];
	var mapVisibleSides: { [index: string]: Side } = {};

	var mapVisited: { [index: string]: boolean } = {};
	var rgVisited:Side[] = [];

	var LIGHT_DISTANCE_THRESHOLD2 = LIGHT_DISTANCE_THRESHOLD * LIGHT_DISTANCE_THRESHOLD;
	var center = root.center;

	for (var iSide = 6; iSide--;)
	{
		var side = root.rgSides[iSide];
		var rgVertices = side.vertices;

		var rgEdges = new Array<LineSegment>(4);
		var rgReverses = new Array<Plane3>(4);

		for (var iEdge = 4; iEdge--;)
		{
			var edge = new LineSegment(rgVertices[iEdge], rgVertices[(iEdge + 1) % 4]);
			rgEdges[iEdge] = edge
			rgReverses[iEdge] = Plane3.fromPoints(edge.start, rgVertices[(iEdge + 3) % 4], edge.end);
			rgReverses[iEdge].normal = rgReverses[iEdge].normal.unit();
		}

		var recurse = function (cube:Cube, rgPlanes:Plane3[], depth:number):void
		{
			if (depth > 25)
				return;

			mapVisited[cube._unique] = true;

			if (!mapVisible[cube.index])
			{
				mapVisible[cube.index] = cube;
				rgVisible.push(cube);
				if (center.distanceTo(cube.center) < LIGHT_DISTANCE_THRESHOLD2)
					rgLightingNeighbors.push(cube);
			}

			for (var iOtherSide = 6; iOtherSide--;)
			{
				var otherSide = cube.rgSides[iOtherSide];
				var neighbor = otherSide.neighbor;

				if (neighbor)
				{
					if (mapVisited[neighbor._unique])
						continue;

					if (!neighbor.center)
						continue;
				}
				else
				{
					if (mapVisibleSides[otherSide._unique])
						continue;
				}

				rgVisited.push(otherSide);


				var minPlanes = new Array<Plane3>(4);

				var rgOtherVertices = otherSide.vertices;
				var rgOtherTriangles = otherSide.rgTriangles;
				var fOutside = false;
				var fFrontSide = false;
				for (var iEdge = 4; iEdge--;)
				{
					var edge = rgEdges[iEdge];
					var vertex = edge.start;
					if (true || rgOtherTriangles[0].distanceTo(vertex) >= 0 || rgOtherTriangles[1].distanceTo(vertex) >= 0)
					{
						var minPlane = rgReverses[iEdge];

						var plane = rgPlanes[iEdge];
						var extent:Vec3;

						var fFront = false;
						var fBehind = false;

						for (var iVertex = 4; iVertex--;)
						{
							var vertexOther = rgOtherVertices[iVertex];

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

						if (fBehind)
						{
							if (fFront)
							{
								minPlane = plane;
							}
							else
							{
								fOutside = true;
								break;
							}
						}

						minPlanes[iEdge] = minPlane;
					}
					else
					{
						var newStart = edge.intersectPlane(rgOtherTriangles[0]);
						if (newStart)
							minPlanes[iEdge] = new Plane3(newStart, rgOtherTriangles[0].normal.unit().neg());
						else
							minPlanes[iEdge] = rgReverses[iEdge].reverse();
					}
				}

				if (!fOutside)
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
						recurse(neighbor, minPlanes, depth + 1);
				}
				rgVisited.pop();
			}

			delete mapVisited[cube._unique];
		}

		var rgInits = rgReverses.map(function (p) { return p.reverse(); });
		recurse(root, rgInits, 1);
	}
	//console.log(rgVisibleSides.length);

	function compareSides(side1:Side, side2:Side):number
	{
		if (side1.tex1 != side2.tex1)
			return side1.tex1 - side2.tex1;
		return side1.tex2 - side2.tex2;
	}
	//rgVisibleSides.sort(compareSides);
	//rgVisibleSidesBlended.sort(compareSides);

	rgVisibleSides.sort(function (s1, s2)
	{
		var d1 = s1.center.distanceTo2(root.center);
		var d2 = s2.center.distanceTo2(root.center);
		return d2 - d1;
	});

	rgVisibleSidesBlended.sort(function (s1, s2)
	{
		var d1 = s1.center.distanceTo2(root.center);
		var d2 = s2.center.distanceTo2(root.center);
		return d1 - d2;
	});

	root.rgVisibleNeighbors = rgVisible;
	root.rgLightingNeighbors = rgLightingNeighbors;
	root.rgVisibleSides = rgVisibleSides;
	root.rgVisibleSidesBlended = rgVisibleSidesBlended;

	return rgVisible;
}
