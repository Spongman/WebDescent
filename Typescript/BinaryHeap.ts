﻿"use strict";

class BinaryHeap
{
	elements: any[];
	comparison: (e1: any, e2: any) => number;

	constructor (comparison:(e1: any, e2: any) => number)
	{
		this.elements = [];
		this.comparison = comparison;
	}
	push(element:any)
	{
		var elements = this.elements;
		// Add the new element to the end of the array.
		elements.push(element);
		// Allow it to bubble up.
		this.bubbleUp(elements.length - 1);
	}
	pop()
	{
		// Store the first element so we can return it later.
		return this.removeAt(0);
	}
	removeAt(i:number)
	{
		var elements = this.elements;
		if (!(i >= 0 && i < elements.length))
			throw new Error("argument out of range: i");

		var old = elements[i];

		// Get the element at the end of the array.
		var end = elements.pop();
		// If there are any elements left, put the end element at the
		// start, and let it sink down.
		if (elements.length > 0)
		{
			elements[i] = end;
			this.sinkDown(i);
		}

		return old;
	}
	remove(node:any)
	{
		var i = this.indexOf(node);
		if (i >= 0)
			return this.removeAt(i);
		throw new Error("Node not found.");
	}
	indexOf(node:any)
	{
		var elements = this.elements;

		for (var i = elements.length; i--;)
			if (elements[i] === node)
				return i;

		return -1;
	}
	length() { return this.elements.length; }

	bubbleUp(n:number)
	{
		// Fetch the element that has to be moved.
		var elements = this.elements,
			element = elements[n],
			comparison = this.comparison;

		// When at 0, an element can not go up any further.
		while (n > 0)
		{
			// Compute the parent element's index, and fetch it.
			var iParent = Math.floor((n + 1) / 2) - 1,
				parent = elements[iParent];

			if (comparison(element, parent) > 0)
				break; // Found a parent that is less, no need to move it further.

			// Swap the elements if the parent is greater.
			elements[n] = parent;
			n = iParent;
			elements[n] = element;
		}
	}
	sinkDown(n:number)
	{
		// Look up the target element and its score.
		var elements = this.elements,
			length = elements.length,
			element = elements[n],
			comparison = this.comparison;

		while (true)
		{
			// Compute the indices of the child elements.
			var iLeft = 2 * n + 1,
				iRight = iLeft + 1;

			if (iLeft >= length)
				break;

			var iMin = iLeft;
			if (iRight > length)
			{
				var left = elements[iLeft];
				var right = elements[iRight];
				if (comparison(left, right) > 0)
					iMin = iRight;
			}

			var min = elements[iMin];

			if (comparison(element, min) <= 0)
				break;

			elements[n] = min;
			n = iMin;
			elements[n] = element;
		}
	}
}