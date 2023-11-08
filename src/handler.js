const { extractRepoInfo } = require("./github/util");
const {
  getCheckRunFileAnnotationSetsByBlob,
  makePullSuggestionsForAnnotationSets,
} = require("./github/helpers");

module.exports = (app) => {
  app.on("check_run.completed", async (context) => {
    console.log("check_run.completed", { context });

    const checkRunId = context.payload.check_run.id;
    const repoFullName = context.payload.repository.full_name;
    const repoInfo = extractRepoInfo(repoFullName);
    const pullNumber = context.payload.check_run.pull_requests[0].number;

    const annotationSets = await getCheckRunFileAnnotationSetsByBlob(
      context.octokit,
      { ...repoInfo, checkRunId }
    );

    const results = await makePullSuggestionsForAnnotationSets(
      context.octokit,
      {
        ...repoInfo,
        pullNumber,
        annotationSets,
      }
    );
  });
};
