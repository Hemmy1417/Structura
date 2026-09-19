import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-5 py-10 sm:px-8">
      <p className="figure text-xs text-ink-3">Sheet not in the set</p>
      <h1 className="title mt-1.5">This sheet does not exist</h1>
      <p className="mt-3 max-w-xl text-ink-2">The address may be mistyped, or the record may belong to another deployment.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/" className="btn btn-primary">Back to the cover</Link>
        <Link href="/projects" className="btn btn-line">Open the register</Link>
      </div>
    </div>
  );
}
