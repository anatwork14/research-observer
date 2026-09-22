import { preparePdfRuntime } from "../lib/research/pdf-runtime.mjs";

const destination = await preparePdfRuntime();
console.log("PDF.js runtime prepared at " + destination);
