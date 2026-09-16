// Stub replacing @smithy/node-http-handler.
//
// @aws-sdk/client-rekognition statically imports this as its DEFAULT HTTP
// request handler, which is built on Node's "https"/"http2" modules —
// neither of which exist in React Native. This app always passes an
// explicit requestHandler (@smithy/fetch-http-handler's FetchHttpHandler,
// which uses fetch() and works fine in React Native) when constructing
// RekognitionClient — see lib/tagging.ts — so this default is never
// actually reached at runtime.
//
// This stub keeps the shape the SDK expects (a class it can reference at
// module load time) without needing any Node built-ins. If it's ever
// actually instantiated, that means lib/tagging.ts stopped passing an
// explicit requestHandler, which would be a bug.
class NodeHttpHandler {
  constructor() {
    throw new Error(
      "NodeHttpHandler stub was instantiated — RekognitionClient should " +
        "always be given an explicit FetchHttpHandler requestHandler " +
        "instead. This indicates a bug in lib/tagging.ts."
    );
  }
}

module.exports = { NodeHttpHandler };
