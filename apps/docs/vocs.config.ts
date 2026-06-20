import { defineConfig } from "vocs";

export default defineConfig({
  title: "Ultraprop Docs",
  description:
    "Documentation for Ultraprop — a crypto-native proprietary trading firm. Tiers, rules, evaluations, the funded phase, and how the platform works.",
  baseUrl: "https://docs.ultraprop.xyz",
  iconUrl: "/favicon.svg",
  logoUrl: { light: "/logo-light.svg", dark: "/logo-dark.svg" },
  font: {
    google: "Hanken Grotesk",
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
      },
      content: {
        width: "44rem",
      },
    },
  },
  socials: [
    { icon: "x", link: "https://x.com/ultraprop" },
  ],
  topNav: [
    { text: "Docs", link: "/", match: "/" },
    { text: "Roadmap", link: "/roadmap" },
    { text: "Launch app", link: "https://ultraprop.xyz" },
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
        { text: "On-chain rule enforcement", link: "/transparency/enforcement" },
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
