import assert from "node:assert/strict";
import test from "node:test";

import { buildContentSecurityPolicy } from "../lib/security/csp.ts";

function getDirectiveMap(policy: string): Map<string, string> {
  const entries = policy
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const [name, ...valueParts] = part.split(/\s+/);
      return [name, valueParts.join(" ")] as const;
    });

  return new Map(entries);
}

test("public routes use nonce-based strict script policy", () => {
  const policy = buildContentSecurityPolicy({
    nonce: "nonce-abc",
    pathname: "/api/checkout/init",
    siteUrl: "https://example.com",
    publicSiteUrl: "https://public.example.com",
    supabaseUrl: "https://project.supabase.co",
  });

  const directives = getDirectiveMap(policy);
  const scriptSrc = directives.get("script-src") ?? "";

  assert.match(scriptSrc, /'nonce-nonce-abc'/);
  assert.match(scriptSrc, /'strict-dynamic'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-eval'/);
  assert.doesNotMatch(scriptSrc, /\bhttps:\b/);
});

test("public routes avoid wildcard connect sources", () => {
  const policy = buildContentSecurityPolicy({
    nonce: "nonce-xyz",
    pathname: "/protected",
    supabaseUrl: "https://project.supabase.co",
  });

  const directives = getDirectiveMap(policy);
  const connectSrc = directives.get("connect-src") ?? "";

  assert.match(connectSrc, /\bhttps:\/\/project\.supabase\.co\b/);
  assert.match(connectSrc, /\bwss:\/\/project\.supabase\.co\b/);
  assert.doesNotMatch(connectSrc, /\bhttps:\b/);
  assert.doesNotMatch(connectSrc, /\bwss:\b/);
});

test("hosted checkout routes allow configured Isbank form action origin", () => {
  const policy = buildContentSecurityPolicy({
    nonce: "nonce-checkout",
    pathname: "/checkout",
    siteUrl: "https://example.com",
    publicSiteUrl: "https://public.example.com",
    supabaseUrl: "https://project.supabase.co",
    isbankCheckoutUrl: "https://sanalpos.isbank.com.tr/fim/est3Dgate",
  });

  const directives = getDirectiveMap(policy);
  const formAction = directives.get("form-action") ?? "";

  assert.match(formAction, /^'self' https:\/\/sanalpos\.isbank\.com\.tr$/);
});

test("admin routes use nonce-based strict script policy", () => {
  const policy = buildContentSecurityPolicy({
    nonce: "nonce-admin",
    pathname: "/admin",
    siteUrl: "https://example.com",
    supabaseUrl: "https://project.supabase.co",
  });

  const directives = getDirectiveMap(policy);
  const scriptSrc = directives.get("script-src") ?? "";
  const styleSrc = directives.get("style-src") ?? "";
  const connectSrc = directives.get("connect-src") ?? "";

  assert.match(scriptSrc, /'nonce-nonce-admin'/);
  assert.match(scriptSrc, /'strict-dynamic'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-eval'/);
  assert.doesNotMatch(scriptSrc, /\bhttps:\b/);
  assert.match(styleSrc, /'nonce-nonce-admin'/);
  assert.match(
    styleSrc,
    /'sha256-UO8\+f0Vt7qym1f9lUl0nh47l5M7MX3W3qSnbWSxu6\+8='/,
  );
  assert.doesNotMatch(styleSrc, /'unsafe-inline'/);
  assert.match(connectSrc, /\bhttps:\/\/project\.supabase\.co\b/);
  assert.match(connectSrc, /\bwss:\/\/project\.supabase\.co\b/);
  assert.doesNotMatch(connectSrc, /\bhttps:\b/);
  assert.doesNotMatch(connectSrc, /\bwss:\b/);
});

test("development mode can opt into unsafe-eval for Next.js React debugging", () => {
  const policy = buildContentSecurityPolicy({
    allowUnsafeEval: true,
    nonce: "nonce-dev",
    pathname: "/admin",
    siteUrl: "http://localhost:3000",
    supabaseUrl: "http://127.0.0.1:54321",
  });

  const directives = getDirectiveMap(policy);
  const scriptSrc = directives.get("script-src") ?? "";

  assert.match(scriptSrc, /'nonce-nonce-dev'/);
  assert.match(scriptSrc, /'strict-dynamic'/);
  assert.match(scriptSrc, /'unsafe-eval'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
});
