async function main() {
  console.log(
    "Global category seeding is no longer required. Tenant categories are created during setup and settings updates.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
