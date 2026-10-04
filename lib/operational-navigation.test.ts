import assert from "node:assert/strict";
import test from "node:test";
import { getOperationalGroups } from "./operational-navigation";

const enabled = { pos: true, purchases: true, barcode: true, inventoryCount: true, multiWarehouse: true, socialMedia: true };

test("admin sees every enabled destination, grouped without duplicates", () => {
  const groups = getOperationalGroups({ role: "SUPER_ADMIN", ...enabled });
  const links = groups.flatMap((group) => group.links.map((link) => link.href));
  assert.equal(new Set(links).size, links.length);
  assert.ok(!links.includes("/"));
  assert.deepEqual(groups.find((group) => group.id === "supply")?.links.map((link) => link.href), ["/purchases", "/suppliers"]);
  assert.ok(links.includes("/stock/scan"));
  assert.ok(links.includes("/billing"));
});

test("seller only sees their permitted destinations", () => {
  const links = getOperationalGroups({ role: "SELLER", ...enabled }).flatMap((group) => group.links.map((link) => link.href));
  assert.deepEqual(links, ["/orders", "/pos", "/products"]);
});

test("disabled modules do not appear", () => {
  const groups = getOperationalGroups({ role: "SUPER_ADMIN", pos: false, purchases: false, barcode: false, inventoryCount: false, multiWarehouse: false, socialMedia: false });
  assert.ok(!groups.some((group) => group.id === "supply" || group.id === "marketing"));
  assert.deepEqual(groups.find((group) => group.id === "stock")?.links.map((link) => link.href), ["/stock/incoming"]);
});

test("warehouse role only sees currently permitted destinations", () => {
  const links = getOperationalGroups({ role: "WAREHOUSE", ...enabled }).flatMap((group) => group.links.map((link) => link.href));
  assert.deepEqual(links, ["/orders", "/products"]);
});
