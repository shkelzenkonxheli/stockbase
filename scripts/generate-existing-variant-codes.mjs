import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  const envContents = fs.readFileSync(envPath, "utf8");

  for (const line of envContents.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^"|"$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function normalizeWords(value) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
}

function toCompactProductCode(value) {
  const words = normalizeWords(value);

  if (words.length === 0) {
    return "ITEM";
  }

  if (words.length === 1) {
    const [word] = words;
    const letters = word.replace(/\d+/g, "");
    const digits = word.replace(/\D+/g, "");
    return `${letters.slice(0, 4)}${digits}`.toUpperCase() || "ITEM";
  }

  const combined = words
    .slice(0, 3)
    .map((word) => {
      const letters = word.replace(/\d+/g, "");
      const digits = word.replace(/\D+/g, "");

      if (!letters && digits) {
        return digits.slice(0, 2);
      }

      return `${letters.slice(0, 2)}${digits.slice(0, 2)}`;
    })
    .join("");

  return combined.toUpperCase().slice(0, 8) || "ITEM";
}

function toCompactColorCode(value) {
  const words = normalizeWords(value);

  if (words.length === 0) {
    return "CLR";
  }

  const combined =
    words.length === 1
      ? words[0].slice(0, 3)
      : words
          .slice(0, 2)
          .map((word) => word.slice(0, 2))
          .join("");

  return combined.toUpperCase() || "CLR";
}

function buildVariantSku({ brand, productName, color, size }) {
  return [
    toCompactProductCode(`${brand} ${productName}`),
    toCompactColorCode(color),
    size.trim().toUpperCase(),
  ].join("-");
}

function ensureUniqueSku(baseSku, usedSkus) {
  let candidate = baseSku;
  let counter = 2;

  while (usedSkus.has(candidate)) {
    candidate = `${baseSku}-${counter}`;
    counter += 1;
  }

  usedSkus.add(candidate);
  return candidate;
}

function buildBarcodeFromVariantId(variantId) {
  const base = `290${String(variantId).padStart(9, "0")}`;
  const digits = base.split("").map(Number);
  const weightedSum = digits.reduce((sum, digit, index) => {
    return sum + digit * (index % 2 === 0 ? 1 : 3);
  }, 0);
  const checkDigit = (10 - (weightedSum % 10)) % 10;

  return `${base}${checkDigit}`;
}

loadDotEnv();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  const { rows: variants } = await client.query(`
    SELECT
      v.id,
      v.size,
      v.color,
      v.sku,
      v.barcode,
      p.name AS "productName",
      p.brand AS "brand"
    FROM "Variant" v
    INNER JOIN "Product" p ON p.id = v."productId"
    ORDER BY v.id ASC
  `);

  const usedSkus = new Set(
    variants.map((variant) => variant.sku).filter(Boolean),
  );

  let updatedCount = 0;

  for (const variant of variants) {
    if (variant.sku) {
      usedSkus.delete(variant.sku);
    }

    const nextSku = ensureUniqueSku(
      buildVariantSku({
        brand: variant.brand,
        productName: variant.productName,
        color: variant.color,
        size: variant.size,
      }),
      usedSkus,
    );
    const nextBarcode = variant.barcode || buildBarcodeFromVariantId(variant.id);

    if (nextSku === variant.sku && nextBarcode === variant.barcode) {
      continue;
    }

    await client.query(
      `UPDATE "Variant" SET "sku" = $1, "barcode" = $2, "updatedAt" = NOW() WHERE id = $3`,
      [nextSku, nextBarcode, variant.id],
    );
    updatedCount += 1;
  }

  console.log(
    JSON.stringify(
      {
        totalVariants: variants.length,
        updatedVariants: updatedCount,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
