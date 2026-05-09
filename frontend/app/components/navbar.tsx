import Link from "next/link";
import { LogoutButton } from "./logout-button";

type NavbarProps = {
	teacherName: string;
	active: "cuaderno" | "guias";
};

const activeLinkClass =
	"text-slate-900 underline decoration-vermilion decoration-2 underline-offset-[6px]";
const inactiveLinkClass =
	"text-slate-500 transition-colors hover:text-slate-900";

export function Navbar({ teacherName, active }: NavbarProps) {
	return (
		<header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/70 bg-white/80 px-6 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
			<nav className="flex items-center gap-6">
				<Link
					href="/"
					className="font-display text-xl tracking-tight text-slate-900"
				>
					Bitácora
				</Link>
				<span className="hidden h-5 w-px bg-slate-200 sm:block" />
				<div className="flex items-center gap-5 text-sm font-medium">
					<Link
						href="/"
						className={
							active === "cuaderno" ? activeLinkClass : inactiveLinkClass
						}
					>
						Cuaderno
					</Link>
					<Link
						href="/worksheets"
						className={
							active === "guias" ? activeLinkClass : inactiveLinkClass
						}
					>
						Guías
					</Link>
				</div>
			</nav>
			<div className="flex items-center gap-4">
				<div className="hidden text-right sm:block">
					<p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
						Profesor
					</p>
					<p className="text-sm font-semibold text-slate-900">{teacherName}</p>
				</div>
				<LogoutButton />
			</div>
		</header>
	);
}
