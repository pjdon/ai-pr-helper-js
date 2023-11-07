// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

const { fixAnnotation } = require("./infer");

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.on("check_run.completed", async (context) => {
    console.log("check_run.completed", { context });

    const checkRunId = context.payload.check_run.id;
    const repoFullName = context.payload.repository.full_name;
    const repoDetails = getRepoDetails(repoFullName);
    const pullNumber = context.payload.check_run.pull_requests[0].number;

    const annotationSet = await getCheckRunFileAnnotationsByBlob(
      context.octokit,
      { ...repoDetails, checkRunId }
    );

    const fileContent = annotationSet[0].content;
    const annotation = annotationSet[0].annotations[0];

    const res = await fixAnnotation({ fileContent, annotation });

    // makeHelpPrComments(context.octokit, {
    //   ...repoDetails,
    //   pullNumber,
    //   annotationSet,
    // });
  });
};

const comment = `\
\`\`\`suggestion
import { html, LitElement } from "lit";
\`\`\`\
`;

async function makeHelpPrComments(
  octokit,
  { owner, repo, pullNumber, annotationSet }
) {
  for (const { path, commit, content, annotations } of annotationSet) {
    for (const ant of annotations) {
      try {
        const res = await octokit.rest.pulls.createReviewComment({
          owner,
          repo,
          pull_number: pullNumber,
          commit_id: commit,
          path,
          body: comment,
          side: "RIGHT",
          line: ant.end_line,
          ...(ant.start_line < ant.end_line
            ? { start_line: ant.start_line }
            : {}),
        });
      } catch (error) {
        console.error("Failed to create review comment", { error });
      }
    }
  }
}

const repoFullNamePattern = /(?<owner>[\w\-]+)\/(?<repo>[\w\-]+)/gim;

function getRepoDetails(repoFullName) {
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

const annotationsFilter = (ant) =>
  !ant.message.startsWith("Process completed with exit code") &&
  ant.annotation_level.toLocaleLowerCase() === "failure";

async function getCheckRunFileAnnotationsByBlob(
  octokit,
  { owner, repo, checkRunId },
  annotationsFilterFunction = annotationsFilter
) {
  let annotations;
  try {
    annotations = await octokit.checks.listAnnotations({
      owner,
      repo,
      check_run_id: checkRunId,
    });

    annotations = annotations.data.filter(annotationsFilterFunction);
  } catch (error) {
    console.error("Failed to get annotations with octokit", {
      error,
      owner,
      repo,
      checkRunId,
    });
    return null;
  }

  const blobMap = new Map();
  for (const ant of annotations) {
    const blobHref = ant.blob_href;
    const data = {
      start_line: ant.start_line,
      end_line: ant.end_line,
      message: ant.message,
    };

    if (blobMap.has(blobHref)) {
      blobMap.get(blobHref).push(data);
    } else {
      blobMap.set(blobHref, [data]);
    }
  }

  // annotations per blob with blob contents
  const hydrated = await Promise.all(
    Array.from(blobMap.entries()).map(
      ([blobHref, annotations]) =>
        new Promise((resolve) => {
          const blobDetails = getBlobHrefDetails(blobHref);

          if (blobDetails == null) {
            return resolve(null);
          }

          return getBlobFileContents(octokit, blobDetails).then((content) => {
            if (content == null) {
              return null;
            }

            return resolve({
              path: blobDetails.path,
              commit: blobDetails.ref,
              content,
              annotations,
            });
          });
        })
    )
  );

  return hydrated.filter((x) => x != null);
}

const githubBlobPattern =
  /https:\/\/github\.com\/(?<owner>[\w\-]+)\/(?<repo>[\w\-]+)\/blob\/(?<ref>\w+)\/(?<path>.+)/gim;

function getBlobHrefDetails(blobHref) {
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

async function getBlobFileContents(octokit, { owner, repo, ref, path }) {
  console.log("getBlobFileContents", { owner, repo, ref, path });
  let file;
  try {
    file = await octokit.rest.repos.getContent({ owner, repo, ref, path });
  } catch (error) {
    console.error("Failed to get blob file with octokit", {
      error,
      blobHref,
      owner,
      repo,
      ref,
      path,
    });
    return null;
  }

  const download_url = file?.data?.download_url;

  if (download_url == null) {
    console.error("Failed to get download url", { file, download_url });
    return null;
  }

  let contents;

  try {
    console.log("fetchContents", { download_url });
    contents = fetch(download_url).then((res) => res.text());
  } catch (error) {
    console.error("Failed to fetch blob contents", { error, download_url });
    return null;
  }

  return contents;
}
