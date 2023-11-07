const OpenAI = require("openai");
const fixAnnotation = require("./fixAnnotation");

const apiKey = process?.env?.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("OPENAI_API_KEY not set");
}

const openai = new OpenAI({ apiKey });

module.exports = {
    fixAnnotation: fixAnnotation(openai)
};