import React from "react";
import { defineConfig } from "vocs";

export default defineConfig({
  title: "Ultraprop Docs",
  description:
    "Documentation for Ultraprop — a crypto-native proprietary trading firm. Tiers, rules, evaluations, the funded phase, and how the platform works.",
  baseUrl: "https://docs.ultraprop.xyz",
  iconUrl: "/favicon.svg",
  logoUrl: { light: "/logo-light.svg", dark: "/logo-dark.svg" },
  font: {
    default: { google: "Hanken Grotesk" },
    mono: { google: "JetBrains Mono" },
  },
  theme: {
    accentColor: {
      light: "#dc3d42",
      dark: "#e5484d",
    },
    variables: {
      color: {
        background: { light: "#fcfcfd", dark: "#0a0a0c" },
        backgroundDark: { light: "#f4f4f6", dark: "#16161a" },
        // AA gate (PRODUCT.md): on near-white, the #dc3d42 brand red as link
        // text is 4.28:1 and the faint token is 3.7:1 — both under 4.5. Deepen
        // them for light only; dark already clears. The brand mark keeps #dc3d42.
        link: { light: "#c4313a", dark: "#e5484d" },
        linkHover: { light: "#a82a31", dark: "#ef6b6f" },
        textAccent: { light: "#c4313a", dark: "#e5484d" },
        textAccentHover: { light: "#a82a31", dark: "#ef6b6f" },
        text3: { light: "#6f6f6f", dark: "#a7a7a8" },
      },
      content: {
        width: "44rem",
      },
    },
  },
  head: React.createElement(
    React.Fragment,
    null,
    React.createElement("meta", { property: "og:image", content: "https://docs.ultraprop.xyz/og-image.png" }),
    React.createElement("meta", { property: "og:image:width", content: "2400" }),
    React.createElement("meta", { property: "og:image:height", content: "1260" }),
    React.createElement("meta", { property: "og:image:alt", content: "Ultraprop — the on-chain crypto prop firm, powered by Sui" }),
    React.createElement("meta", { property: "og:site_name", content: "Ultraprop Docs" }),
    React.createElement("meta", { property: "og:type", content: "website" }),
    React.createElement("meta", { name: "twitter:card", content: "summary_large_image" }),
    React.createElement("meta", { name: "twitter:site", content: "@ultraprop_xyz" }),
    React.createElement("meta", { name: "twitter:image", content: "https://docs.ultraprop.xyz/og-image.png" }),
  ),
  socials: [{ icon: "x", link: "https://x.com/ultraprop_xyz" }],
  topNav: [
    { text: "Docs", link: "/", match: "/" },
    { text: "Roadmap", link: "/roadmap" },
    { text: "Launch app", link: "https://app.ultraprop.xyz" },
  ],
  sidebar: [
    {
      text: "Introduction",
      items: [
        { text: "What is Ultraprop", link: "/" },
        { text: "Getting started", link: "/getting-started" },
        { text: "How it works", link: "/how-it-works" },
      ],
    },
    {
      text: "Evaluations",
      items: [
        { text: "Tiers & accounts", link: "/evaluations/tiers" },
        { text: "The rules", link: "/evaluations/rules" },
        { text: "Markets & instruments", link: "/evaluations/markets" },
        { text: "Placing trades", link: "/evaluations/trading" },
        { text: "Passing & failing", link: "/evaluations/outcomes" },
        { text: "Fees & payment", link: "/evaluations/payment" },
      ],
    },
    {
      text: "Your track record",
      items: [
        { text: "The Genesis credential", link: "/record/credential" },
        { text: "Leaderboard", link: "/record/leaderboard" },
        { text: "Your public profile", link: "/record/profile" },
      ],
    },
    {
      text: "The funded phase",
      collapsed: false,
      items: [
        { text: "From evaluation to funded", link: "/funded/overview" },
        { text: "Profit splits & scaling", link: "/funded/splits" },
        { text: "Payouts", link: "/funded/payouts" },
      ],
    },
    {
      text: "How the platform works",
      items: [
        {
          text: "On-chain rule enforcement",
          link: "/transparency/enforcement",
        },
        { text: "The fill & slippage model", link: "/transparency/fill-model" },
        { text: "Prices & oracles", link: "/transparency/prices" },
        { text: "Verifiability", link: "/transparency/verifiability" },
      ],
    },
    {
      text: "Roadmap & reference",
      items: [
        { text: "Roadmap", link: "/roadmap" },
        { text: "Glossary", link: "/reference/glossary" },
        { text: "FAQ", link: "/reference/faq" },
      ],
    },
  ],
});
