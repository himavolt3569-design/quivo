"use client";

export function Footer() {
  return (
    <footer className="bg-[#1B2030] py-12 text-white">
      <div className="container flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#A7653A] font-bold">
              Q
            </span>
            <span className="text-xl font-bold">Quivo</span>
          </div>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/58">
            Quivo means Quick + Inventory: built for Nepali businesses that need
            fast stock answers, secure records, and easier shop operations.
          </p>
        </div>
        <div className="flex flex-wrap gap-5 text-sm font-medium text-white/68">
          {["Features", "Pricing", "Support", "Privacy", "Terms"].map(
            (link) => (
              <a
                key={link}
                href="#top"
                className="transition hover:text-[#D8C99A]"
              >
                {link}
              </a>
            ),
          )}
        </div>
        <p className="text-sm text-white/45">© 2026 Quivo Inc.</p>
      </div>
    </footer>
  );
}
