import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="glass-strong fixed top-1/2 left-1/2 z-[1200] -translate-1/2 rounded-2xl px-6 py-5 text-center">
      <h1 className="font-heading text-xl font-semibold">Place not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <Link href="/" className="text-gold underline underline-offset-2">
          Back to the map
        </Link>
      </p>
    </div>
  );
}
