const repoFullNamePattern = /(?<owner>[\w\-]+)\/(?<repo>[\w\-]+)/im;

function extractRepoInfo(repoFullName) {
  const match = repoFullNamePattern.exec(repoFullName);
  if (match == null) {
    console.error("Failed to match repo full name", { repoFullName });
    return null;
  }

  const owner = match.groups?.owner;
  const repo = match.groups?.repo;

  const properties = { owner, repo };

  if (owner == null || repo == null) {
    console.error("Failed to extract properties", {
      properties,
      repoFullName,
      match,
    });
    return null;
  }

  return properties;
}

const githubBlobPattern =
  /https:\/\/github\.com\/(?<owner>[\w\-]+)\/(?<repo>[\w\-]+)\/blob\/(?<ref>\w+)\/(?<path>.+)/im;

function extractBlobHrefInfo(blobHref) {
  const match = githubBlobPattern.exec(blobHref);
  if (match == null) {
    console.error("Failed to match gibhub blob path", { blobHref });
    return null;
  }

  const owner = match.groups?.owner;
  const repo = match.groups?.repo;
  const ref = match.groups?.ref;
  const path = match.groups?.path;

  const details = { owner, repo, ref, path };

  if (owner == null || repo == null || ref == null || path == null) {
    console.error("Failed to extract details", { details, blobHref, match });
    return null;
  }

  return details;
}

function makeCodeSuggestion(codetext) {
  return `\`\`\`suggestion\n${codetext}\n\`\`\``;
}

module.exports = {
  extractRepoInfo,
  extractBlobHrefInfo,
  makeCodeSuggestion,
};
