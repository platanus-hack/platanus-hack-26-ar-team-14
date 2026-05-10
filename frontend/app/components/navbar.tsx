import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "./logout-button";

type NavbarProps = {
	teacherName: string;
	active: "cuaderno" | "banco" | "guias" | "planificacion";
};

// Hardcoded para el demo (ver CURRENT_WEEKDAY en bitacora-dashboard.tsx).
// Asumimos que hoy es miércoles 13 de mayo de 2026.
const TODAY_LABEL = "Miércoles 13 de mayo";

const activeLinkClass =
	"text-slate-900 underline decoration-vermilion decoration-2 underline-offset-[6px]";
const inactiveLinkClass =
	"text-slate-500 transition-colors hover:text-slate-900";

const linkClass = (
	target: NavbarProps["active"],
	current: NavbarProps["active"],
) => (target === current ? activeLinkClass : inactiveLinkClass);

export function Navbar({ teacherName, active }: NavbarProps) {
	return (
		<header className="bitacora-navbar">
			<nav className="flex items-center gap-6">
				<Link
					href="/"
					className="font-display text-xl tracking-tight text-slate-900"
				>
					Bitácora
				</Link>
				<span className="hidden h-5 w-px bg-slate-200 sm:block" />
				<div className="flex items-center gap-5 text-sm font-medium">
					<Link href="/" className={linkClass("cuaderno", active)}>
						Inicio
					</Link>
					<Link href="/banco" className={linkClass("banco", active)}>
						Ejercicios
					</Link>
					<Link href="/guias" className={linkClass("guias", active)}>
						Trabajo práctico
					</Link>
					<Link
						href="/planificacion"
						className={linkClass("planificacion", active)}
					>
						Planificador
					</Link>
				</div>
			</nav>
			<div className="flex items-center gap-3">
				<span
					title="Fecha asumida para el demo"
					className="hidden items-center gap-1.5 rounded-full bg-[#dbeafe] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700 ring-1 ring-inset ring-blue-400/40 md:inline-flex"
				>
					<CalendarDays size={13} strokeWidth={2.5} />
					{TODAY_LABEL}
				</span>
				<div className="hidden items-center gap-2 sm:flex">
					<span className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold uppercase tracking-wide text-white">
						{teacherName
							.split(" ")
							.map((p) => p[0])
							.slice(0, 2)
							.join("")}
					</span>
					<span className="text-sm font-medium text-slate-900">
						{teacherName}
					</span>
				</div>
				<LogoutButton />
			</div>
		</header>
	);
}
