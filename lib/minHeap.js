module.exports = MinHeap;

/**
 * Min heap implementation (aka priority queue).
 * @param {Array} array Optional backing store for the heap.
 * @param {Function} comparator(a, b) Optional compare function for heap sorting.
 */
function MinHeap(array, comparator) {
  /**
   * Storage for heap. 
   * @private
   */
  this.heap = array || [];

  /**
   * Default comparator used if an override is not provided.
   * @private
   */
  this.compare = comparator || function(item1, item2) {
    return item1 == item2 ? 0 : item1 < item2 ? -1 : 1;
  };

  /**
   * Ensure that the contents of the heap don't violate the 
   * constraint. 
   * @private
   */
  this.heapify = function(i) {
    var lIdx = left(i);
    var rIdx = right(i);
    var smallest;
    if (lIdx < this.heap.length && this.compare(this.heap[lIdx], this.heap[i]) < 0)
      smallest = lIdx;
    else
      smallest = i;

    if (rIdx < this.heap.length && this.compare(this.heap[rIdx], this.heap[smallest]) < 0)
      smallest = rIdx;

    if (i != smallest) {
      var temp = this.heap[smallest];
      this.heap[smallest] = this.heap[i];
      this.heap[i] = temp;
      this.heapify(smallest);
    }
  };

  /**
   * Starting with the node at index i, move up the heap until parent value
   * is less than the node.
   * @private
   */
  this.siftUp = function(i) {
    var p = parent(i);
    if (p >= 0 && this.compare(this.heap[p], this.heap[i]) > 0) {
      var temp = this.heap[p];
      this.heap[p] = this.heap[i];
      this.heap[i] = temp;
      this.siftUp(p);
    }
  };

  /**
   * Heapify the contents of an array.
   * This function is called when an array is provided.
   * @private
   */
  this.heapifyArray = function() {
    // for loop starting from floor size/2 going up and heapify each.
    var i = Math.floor(this.heap.length / 2) - 1;
    for (; i >= 0; i--) {
      this.heapify(i);
    }
  };

  // If an initial array was provided, then heapify the array.
  if (array)
    this.heapifyArray();
}

/**
 * Place an item in the heap.  
 * @param item
 */
MinHeap.prototype.push = function(item) {
  this.heap.push(item);
  this.siftUp(this.heap.length - 1);
};

/**
 * Pop the minimum valued item off of the heap. The heap is then updated 
 * to float the next smallest item to the top of the heap.
 * @returns the minimum value contained within the heap.
 */
MinHeap.prototype.pop = function() {
  var value;
  if (this.heap.length > 1) {
    value = this.heap[0];
    // Put the bottom element at the top and let it drift down.
    this.heap[0] = this.heap.pop();
    this.heapify(0);
  } else {
    value = this.heap.pop();
  }
  return value;
};

/**
 * Returns the minimum value contained within the heap.  This will
 * not remove the value from the heap.
 * @returns the minimum value within the heap.
 */
MinHeap.prototype.getMin = function() {
  return this.heap[0];
};

/**
 * Return the current number of elements within the heap.
 * @returns size of the heap.
 */
MinHeap.prototype.size = function() {
  return this.heap.length;
};

function left(i) {
  return 2 * i + 1;
}

function right(i) {
  return 2 * i + 2;
}

function parent(i) {
  return Math.ceil(i / 2) - 1;
}
