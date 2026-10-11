export function reportFilename(generatedAt = new Date()) {
  const two = value => String(value).padStart(2, '0');
  const date = `${generatedAt.getFullYear()}-${two(generatedAt.getMonth() + 1)}-${two(generatedAt.getDate())}`;
  const time = `${two(generatedAt.getHours())}-${two(generatedAt.getMinutes())}`;
  return `Daily news update - ${date} ${time}.docx`;
}
