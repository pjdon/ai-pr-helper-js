// Checks API example
// See: https://developer.github.com/v3/checks/ to learn more

const { extractRepoInfo } = require("./github/util");
const {
  getCheckRunFileAnnotationSetsByBlob,
  makePullSuggestionsForAnnotationSets,
} = require("./github/helpers");

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
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

    // const fileContent = annotationSets[0].content;
    // const annotation = annotationSets[0].annotations[0];

    // const res = await fixAnnotation({ fileContent, annotation });

    // makeHelpPrComments(context.octokit, {
    //   ...repoInfo,
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
