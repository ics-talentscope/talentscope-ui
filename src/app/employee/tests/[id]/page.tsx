import TestRunnerClient from "./TestRunnerClient";

export default async function TestRunner({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ buffer?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  return <TestRunnerClient testId={id} bufferOnLoad={query.buffer === "1"} />;
}
