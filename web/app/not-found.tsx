import Link from "next/link";

export default function NotFound() {
  return (
    <section className="bg-card px-5 py-20">
      <div className="mx-auto max-w-[1180px]">
        <p className="kicker">Not found</p>
        <h1 className="heading-lg mt-3 max-w-[16ch]">This page is not part of the record.</h1>
        <p className="mt-5 max-w-[46ch] text-[1.25rem] leading-[1.4] tracking-[-0.019em] text-slate">
          The address may be mistyped, or the record may belong to another deployment.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary no-underline">Back to the start</Link>
          <Link href="/projects" className="btn btn-neutral no-underline">Open the register</Link>
        </div>
      </div>
    </section>
  );
}
