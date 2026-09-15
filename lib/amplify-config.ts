// Amplify Gen 1 client config for github.com/PhotOp-io/backend.
//
// These are PLACEHOLDER values. The real ones come from that backend's
// Amplify project (App ID dhio6clqqxihz, region us-west-2) — either by
// running `amplify pull --appId dhio6clqqxihz --envName <test|prod>`
// inside that repo (requires AWS credentials with access to account
// 652453621243) and copying the generated aws-exports.js values here, or
// by pulling them from the AWS Console (Cognito User Pool, AppSync API
// settings, S3 bucket) directly.
//
// Nothing in this app will successfully reach the backend until these are
// filled in with real values.

const awsconfig = {
  aws_project_region: "us-west-2",

  // Cognito
  aws_cognito_region: "us-west-2",
  aws_user_pools_id: "REPLACE_WITH_USER_POOL_ID", // e.g. us-west-2_xxxxxxxxx
  aws_user_pools_web_client_id: "REPLACE_WITH_USER_POOL_CLIENT_ID",
  // Identity Pool is required for calling Rekognition directly from the
  // client (see lib/tagging.ts) and for Amplify Storage's S3 access.
  aws_cognito_identity_pool_id: "REPLACE_WITH_IDENTITY_POOL_ID",

  // AppSync / GraphQL
  aws_appsync_graphqlEndpoint: "REPLACE_WITH_APPSYNC_ENDPOINT", // https://xxxx.appsync-api.us-west-2.amazonaws.com/graphql
  aws_appsync_region: "us-west-2",
  // Schema's default auth is Cognito User Pools, with an API_KEY mode
  // available for unauthenticated/public reads on some models.
  aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",
  aws_appsync_apiKey: "REPLACE_WITH_APPSYNC_API_KEY_IF_NEEDED",

  // S3 (the "UserCreatedMedia" storage category, bucket name unknown from
  // the repo alone — provisioned bucket names include a random suffix)
  aws_user_files_s3_bucket: "REPLACE_WITH_S3_BUCKET_NAME",
  aws_user_files_s3_bucket_region: "us-west-2",
};

export default awsconfig;
