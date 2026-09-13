import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Defaults are right for this app: every route is server-rendered on demand,
// so there is no incremental cache worth configuring for a demo.
export default defineCloudflareConfig();
