"use strict";
/**
 * Generator dispatcher
 * Routes to the appropriate language generator based on SDK config
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSDK = generateSDK;
exports.isLanguageSupported = isLanguageSupported;
const typescript_1 = require("./typescript");
const python_1 = require("./python");
const golang_1 = require("./golang");
const java_1 = require("./java");
const rust_1 = require("./rust");
/**
 * Generate SDK for a specific language
 */
async function generateSDK(spec, config) {
    const generator = getGenerator(config.language);
    await generator(spec, config);
}
/**
 * Get the generator function for a specific language
 */
function getGenerator(language) {
    const generators = {
        typescript: typescript_1.generateTypeScriptSDK,
        python: python_1.generatePythonSDK,
        go: golang_1.generateGoSDK,
        java: java_1.generateJavaSDK,
        rust: rust_1.generateRustSDK,
    };
    const generator = generators[language];
    if (!generator) {
        throw new Error(`Unsupported language: ${language}`);
    }
    return generator;
}
/**
 * Check if a language is supported
 */
function isLanguageSupported(language) {
    return ['typescript', 'python', 'go', 'java', 'rust'].includes(language);
}
//# sourceMappingURL=index.js.map