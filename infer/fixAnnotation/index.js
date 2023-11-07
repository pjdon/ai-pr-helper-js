const { formatSchema } = require("../util.js");

const inputSchema = require("./input.schema.json");
const outputSchema = require("./output.schema.json");

const systemPrompt = `\
Consume input in the JSON schema format
${formatSchema(inputSchema)}

Determine the changes that need to be made to the text in 'fileContent'
based on the 'message' and 'start_line', 'end_line' properties in 'annotation'

Call the function 'publish_change' where
  'changeText' is the new text that will replace the old text in 'fileContent' but only the necessary lines
  'start_line' is the line number to start replacing text
  'end_line' is the line number to stop replacing text
`;

module.exports = (openai) => {
  async function inferFixAnnotation(input) {
    const inputString = JSON.stringify(input);

    const pkg = {
      model: "gpt-4-1106-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: inputString },
      ],
      functions: [
        {
          name: "publish_change",
          description: "stores the count of each item found in the text",
          parameters: outputSchema,
        },
      ],
      temperature: 0.2,
      max_tokens: 4095,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    };

    const completion = await openai.chat.completions.create(pkg);
    const result = JSON.parse(
      completion.choices[0].message.function_call.arguments
    );

    return result;
  }

  return inferFixAnnotation;
};
