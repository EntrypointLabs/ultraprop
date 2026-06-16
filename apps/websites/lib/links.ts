export const links = {
  home: "/",
  app: "https://app.ultraprop.xyz",
  docs: "https://docs.ultraprop.xyz",
  blog: "https://blog.ultraprop.xyz",
  x: "https://x.com/ultraprop",
  discord: "https://discord.gg/ultraprop",
  telegram: "https://t.me/ultraprop",
} as const;

/** Spread onto an <a> that leaves this site so it opens safely in a new tab. */
export const external = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;
