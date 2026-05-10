import Link from "next/link";
import { LogoutButton } from "./logout-button";

type NavbarProps = {
	teacherName: string;
	active: "cuaderno" | "banco" | "guias" | "planificacion";
};

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
