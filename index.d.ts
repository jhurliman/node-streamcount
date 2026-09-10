/// <reference types="node" />
export interface SerializeOptions { legacy?: boolean; }
export interface DeserializeOptions { maxEntries?: number; }
/** Constructors return structural counter objects, not instanceof-compatible instances. */
export class CountMinSketch {
  constructor(maxEntries: number, epsilon: number, delta: number);
  /** Add a nonnegative uint32 integer weight (default 1); zero is a no-op. */
  increment(key: string, incrementBy?: number): void;
  getTopK(): Array<[count: number, key: string]>;
  serialize(options?: SerializeOptions): Buffer;
  static deserialize(buffer: Buffer, start?: number, length?: number, options?: DeserializeOptions): CountMinSketch;
}
export class HyperLogLog {
  constructor(stdError: number);
  M: number[];
  add(key: string): void;
  count(): number;
  serialize(): Buffer;
  merge(other: HyperLogLog): void;
  static deserialize(buffer: Buffer, start?: number, length?: number): HyperLogLog;
}
export function createUniquesCounter(stdError?: number): HyperLogLog;
export function createViewsCounter(topEntryCount: number, errFactor?: number, failRate?: number): CountMinSketch;
export function getUniquesObjSize(stdError?: number): number;
/** Excludes variable-sized heap entries; each adds 8 bytes plus its UTF-8 key. */
export function getViewsObjSize(errFactor?: number, failRate?: number): number;
export class MinHeap<T = number> {
  constructor(array?: T[], comparator?: (a: T, b: T) => number);
  heap: T[];
  compare: (a: T, b: T) => number;
  heapify(index: number): void;
  siftUp(index: number): void;
  heapifyArray(): void;
  push(item: T): void;
  pop(): T | undefined;
  getMin(): T | undefined;
  size(): number;
}
export interface RandomGenerator {
  (): number;
  random(): number;
  uint32(): number;
  fract53(): number;
  version: string;
  args: Array<string | number>;
}
export interface RandomConstructor {
  (...seeds: Array<string | number>): RandomGenerator;
  new (...seeds: Array<string | number>): RandomGenerator;
}
export const PRNG: RandomConstructor;
