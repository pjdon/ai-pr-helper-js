// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  // app.on(["check_suite.requested", "check_run.rerequested"], check);

  // async function check(context) {
  //   const startTime = new Date();

  //   // Do stuff
  //   const { head_branch: headBranch, head_sha: headSha } =
  //     context.payload.check_suite;
  //   // Probot API note: context.repo() => {username: 'hiimbex', repo: 'testing-things'}
  //   return context.octokit.checks.create(
  //     context.repo({
  //       name: "My app!",
  //       head_branch: headBranch,
  //       head_sha: headSha,
  //       status: "completed",
  //       started_at: startTime,
  //       conclusion: "success",
  //       completed_at: new Date(),
  //       output: {
  //         title: "Probot check!",
  //         summary: "The check has passed!",
  //       },
  //     })
  //   );

  app.on("check_run.completed", async context => {
    console.log("check_run.completed", { context });

    const checkRunId = context.payload.check_run.id;
    const repoFullName = context.payload.repository.full_name;
    const repoDetails = getRepoDetails(repoFullName);

    const run = await context.octokit.checks.get({
      owner: "pjdon", repo: "bsc-demo",
      check_run_id: context.payload.check_run.id
    });

    const annots = await context.octokit.checks.listAnnotations({
      owner: "pjdon", repo: "bsc-demo",
      check_run_id: context.payload.check_run.id
    });

    const contents = await getBlobFileContents(context, annots.data[0].blob_href);
  });

  app.on("workflow_job.completed", async context => {
    console.log("workflow_job.completed", { context });
  });
}

const repoFullNamePattern = /(?<owner>[\w\-]+)\/(?<repo>[\w\-]+)/gmi;

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
    console.error("Failed to extract properties", { properties, repoFullName, match });
    return null;
  }

  return properties;
}

const annotationsFilter = ant => (
  !ant.message.startsWith("Process completed with exit code")
  && ant.annotation_level.toLocalLowerCase() === "failure"
);

async function getCheckRunFileAnnotationsByBlob(octokit, { owner, repo, checkRunId }, annotationsFilterFunction = annotationsFilter) {
  let annotations;
  try {
    annotations = await context.octokit.checks.listAnnotations({
      owner,
      repo,
      check_run_id: checkRunId
    });
  } catch (error) {
    console.error("Failed to get annotations with octokit", { error, owner, repo, checkRunId });
    return null;
  }

  annotations = annotations.filter(annotationsFilterFunction);

  const blobMap = new Map();
  for (const ant in annotations) {
    const blobHref = ant.blob_href;
    const data = {
      start_line: ant.start_line,
      start_column: ant.start_column,
      end_line: ant.end_line,
      end_column: ant.end_column,
      message: ant.message,
      row_details: ant.row_details
    };

    if (blobMap.has(blobHref)) {
      blobMap.get(blobHref).push(data);
    } else {
      blobMap.set(blobHref, [data]);
    }
  }

  // annotations per blob with blob contents
  const hydrated = await Promise.all(
    Array.from(blobMap.entries()).map(([blobHref, annotations]) => {
      const blobDetails = getBlobHrefDetails(blobHref);

      if (blobDetails == null) {
        return (async () => null)();
      }

      return getBlobFileContents(octokit, blobDetails).then(content => {
        if (content == null) {
          return null;
        }


      })
    })
  )
}

const githubBlobPattern = /https:\/\/github\.com\/(?<owner>[\w\-]+)\/(?<repo>[\w\-]+)\/blob\/(?<ref>\w+)\/(?<path>.+)/gmi;
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
  let file;
  try {
    file = await octokit.rest.repos.getContent(properties);
  } catch (error) {
    console.error("Failed to get blob file with octokit", { error, blobHref, owner, repo, ref, path });
    return null;
  }

  const download_url = file?.data?.download_url;

  if (download_url == null) {
    console.error("Failed to get download url", { file, download_url });
    return null;
  }

  let contents;
  try {
    contents = await fetch(download_url).then(res => res.text());
  } catch (error) {
    console.error("Failed to fetch blob contents", { error, download_url });
    return null;
  }

  return contents
}