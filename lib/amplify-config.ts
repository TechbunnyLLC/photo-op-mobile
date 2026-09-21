// Amplify Gen 1 client config for github.com/PhotOp-io/backend.
//
// These are the real values for the **test** environment (stack
// amplify-photoop-test-94334, App ID dhio6clqqxihz, account 652453621243,
// region us-west-2), pulled directly via the AWS CLI. To point this app
// at prod instead, pull the equivalent prod values (Cognito User Pool,
// Identity Pool, AppSync API, S3 bucket) and swap them in here.

import { Amplify } from "aws-amplify";

const awsconfig = {
  aws_project_region: "us-west-2",

  // Cognito
  aws_cognito_region: "us-west-2",
  aws_user_pools_id: "us-west-2_eQgIwMgSl",
  aws_user_pools_web_client_id: "2s1nl150jkfgli92nqkj1lik2c",
  // Identity Pool is required for calling Rekognition directly from the
  // client (see lib/tagging.ts) and for Amplify Storage's S3 access.
  aws_cognito_identity_pool_id: "us-west-2:7eb5b540-ee9a-4343-8c37-fd5d076624cb",

  // AppSync / GraphQL
  aws_appsync_graphqlEndpoint:
    "https://os4rchf63javbpf6vhp47rj3ti.appsync-api.us-west-2.amazonaws.com/graphql",
  aws_appsync_region: "us-west-2",
  aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",

  // S3 (the "UserCreatedMedia" storage category)
  aws_user_files_s3_bucket: "photo-op-user-created-media94334-test",
  aws_user_files_s3_bucket_region: "us-west-2",
};

// Configured as an import side effect, right here, rather than at the
// app's entry point (app/_layout.tsx). This used to live there, one line
// below where awsconfig gets imported — but ES module imports always
// fully resolve before any of the *importing* file's own top-level code
// runs, so anything else this same import chain pulls in ahead of that
// line (lib/api.ts calls generateClient() at module scope, and
// _layout.tsx's import of AuthProvider drags that in before its own
// Amplify.configure() line is reached) was calling into Amplify before
// it had been configured — harmless in practice (generateClient() holds
// a live reference to the Amplify singleton, not a frozen snapshot, so
// it still picks up the real config by the time any actual request
// fires) but it printed a spurious "Amplify has not been configured"
// warning on every launch. Configuring here instead — in the module that
// every one of those import chains already has to load first to read
// awsconfig itself — makes the warning impossible rather than harmless.
Amplify.configure(awsconfig);

export default awsconfig;
