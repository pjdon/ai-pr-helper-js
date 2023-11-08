const { makeCodeSuggestion, extractBlobHrefInfo } = require("./util");
const { inferAnnotationFix } = require("../infer");

async function makePullSuggestionsForAnnotationSets(
  octokit,
  { owner, repo, pullNumber, annotationSets }
) {
  return await Promise.all(
    annotationSets.map(
      async ({ path, commit, content, annotations }) =>
        await makePullSuggestionCommentForAnnotationSet(octokit, {
          owner,
          repo,
          pullNumber,
          path,
          commit,
          content,
          annotations,
        })
    )
  );
}

async function makePullSuggestionCommentForAnnotationSet(
  octokit,
  { owner, repo, pullNumber, path, commit, content, annotations }
) {
  return await Promise.all(
    annotations.map(
      async (annotation) =>
        await makePullSuggestionCommentForAnnotation(octokit, {
          owner,
          repo,
          pullNumber,
          path,
          commit,
          content,
          annotation,
        })
    )
  );
}

async function makePullSuggestionCommentForAnnotation(
  octokit,
  { owner, repo, pullNumber, path, commit, content, annotation }
) {
  const change = await inferAnnotationFix({ fileContent: content, annotation });
  return makePullSuggestionComment(octokit, {
    owner,
    repo,
    pullNumber,
    path,
    commit,
    change,
  });
}

async function makePullSuggestionComment(
  octokit,
  { owner, repo, pullNumber, path, commit, change }
) {
  try {
    // TODO: create new body from change as suggestion

    body = makeCodeSuggestion(change.changeText);

    const pkg = {
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: commit,
      path,
      body,
      line: change.end_line,
      side: "RIGHT"
    };

    if (change.start_line < change.end_line) {
      pkg.start_line = change.start_line;
    }

    const result = await octokit.rest.pulls.createReviewComment(pkg);

    return result;
  } catch (error) {
    console.error("Failed to create pull suggestion comment", { error });
  }
}

const annotationsFilter = (ant) =>
  !ant.message.startsWith("Process completed with exit code") &&
  ant.annotation_level.toLocaleLowerCase() === "failure";

async function getCheckRunFileAnnotationSetsByBlob(
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
  const annotationSets = await Promise.all(
    Array.from(blobMap.entries()).map(
      ([blobHref, annotations]) =>
        new Promise((resolve) => {
          const blobInfo = extractBlobHrefInfo(blobHref);

          if (blobInfo == null) {
            return resolve(null);
          }

          return getBlobFileContents(octokit, blobInfo).then((content) => {
            if (content == null) {
              return null;
            }

            return resolve({
              path: blobInfo.path,
              commit: blobInfo.ref,
              content,
              annotations,
            });
          });
        })
    )
  );

  return annotationSets.filter((x) => x != null);
}

async function getBlobFileContents(octokit, { owner, repo, ref, path }) {
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

module.exports = {
  makePullSuggestionComment,
  getCheckRunFileAnnotationSetsByBlob,
  getBlobFileContents,
  makePullSuggestionsForAnnotationSets
};
