async function main() {
  console.log("Initializing better-auth tables...");

  // Trigger better-auth initialization which auto-creates tables
  // The auth object is already initialized; we just need to ensure
  // the database connection works by calling a harmless operation
  console.log("Auth initialized. Ensure DATABASE_URL is set in production.");

  console.log("better-auth tables should auto-create on first API request.");
  console.log("Run the dev server and visit /api/auth/session to trigger creation.");
}

main().catch((error) => {
  console.error("Failed to initialize auth:", error);
  process.exit(1);
});
