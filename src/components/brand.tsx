import Link from "next/link";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Brightloop home">
      <span className="brand-mark" aria-hidden="true">
        b
      </span>
      brightloop<span className="brand-dot">.</span>
    </Link>
  );
}
