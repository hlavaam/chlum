import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

export default {
  ...defineCloudflareConfig({}),
  buildCommand: "npm run build:next",
};
