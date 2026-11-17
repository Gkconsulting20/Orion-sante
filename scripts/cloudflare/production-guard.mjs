if (process.env.ORION_PRODUCTION_APPROVED !== "yes") {
  console.error("Production blocked. Obtain creator approval before setting ORION_PRODUCTION_APPROVED=yes.");
  process.exit(1);
}
