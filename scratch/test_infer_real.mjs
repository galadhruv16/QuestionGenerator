import { inferTopicsFromChunks } from '../apps/api/src/services/topic-inferencer.js';

const sampleChunks = [
  {
    chunk_index: 0,
    id: 'c0',
    page_number: 1,
    text: `JavaScript for Beginners Course notes.
Chapter 1: JavaScript Fundamentals and Syntax.
JavaScript is a high-level, dynamic, multi-paradigm programming language. Variables are declared using let, const, and var. Primitive types include number, string, boolean, null, undefined, symbol, and bigint. Objects and arrays store complex collections.`
  },
  {
    chunk_index: 1,
    id: 'c1',
    page_number: 2,
    text: `Chapter 2: Functions, Scope, and Closures.
Functions are first-class citizens in JavaScript. They can be passed as arguments, returned from other functions, and assigned to variables. Arrow functions provide a concise syntax and lexical this binding. Closures allow inner functions to access outer function variables even after the outer function has returned.`
  },
  {
    chunk_index: 2,
    id: 'c2',
    page_number: 3,
    text: `Chapter 3: Asynchronous JavaScript and the Event Loop.
JavaScript is single-threaded, executing on a single call stack. The event loop coordinates asynchronous callbacks from Web APIs via the microtask and macrotask queues. Promises represent the eventual completion or failure of an asynchronous operation, avoiding callback hell.`
  },
  {
    chunk_index: 3,
    id: 'c3',
    page_number: 4,
    text: `Chapter 4: The Document Object Model (DOM) and Browser Events.
The DOM represents HTML documents as an object tree. Developers use methods like querySelector and getElementById to access elements. Event-based programming enables handling user interactions through event listeners attached via addEventListener.`
  }
];

console.log('Testing inferTopicsFromChunks with phi3:latest...');
const t0 = Date.now();
try {
  const result = await inferTopicsFromChunks(sampleChunks, 'phi3:latest', 120000);
  console.log(`Success in ${(Date.now() - t0) / 1000}s! Model used:`, result.modelUsed);
  console.log(JSON.stringify(result.modules, null, 2));
} catch (err) {
  console.error('Error during inferTopicsFromChunks:', err);
}
