export function formatEvolutionDate(value) {
  const date = new Date(value);
  const dateOnly = value.endsWith("T00:00:00.000Z");
  const options = {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  };
  if (!dateOnly) {
    options.hour = "2-digit";
    options.minute = "2-digit";
    options.timeZoneName = "short";
  }
  return new Intl.DateTimeFormat("en-US", options).format(date);
}
