function formatSchema(schemaObject) {
  return `\`\`\`\n${JSON.stringify(schemaObject)}\n\`\`\``;
}

module.exports = {
  formatSchema
};
